// WhatsApp Cloud — Inbound Processor (Fase 1.1)
// Disparado por trigger pg_net (real-time) e por cron de backup (a cada 2min).
// Fluxo de 13 passos, claim atômico, quota, regra de persona do tenant (nunca AMZ).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type QueueRow = {
  id: string;
  wamid: string;
  user_id: string | null;
  phone_number_id: string;
  from_number: string;
  message_type: string | null;
  payload: any;
  status: string;
  attempts: number;
};

async function failQueue(id: string, error: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "failed", error, processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function doneQueue(id: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "done", processed_at: new Date().toISOString(), error: null })
    .eq("id", id);
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.text?.body) return payload.text.body;
  if (payload.button?.text) return payload.button.text;
  if (payload.interactive?.button_reply?.title) return payload.interactive.button_reply.title;
  if (payload.interactive?.list_reply?.title) return payload.interactive.list_reply.title;
  return "";
}

async function callGemini(systemPrompt: string, history: Array<{ role: string; content: string }>, userText: string): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function sendWhatsApp(user_id: string, to: string, message: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({ user_id, to, message }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`send ${res.status}: ${txt.slice(0, 200)}`);
  try {
    const j = JSON.parse(txt);
    return j?.message_id ?? j?.wamid ?? null;
  } catch {
    return null;
  }
}

async function processOne(queueId: string) {
  // PASSO 2 — Claim atômico (único cadeado entre trigger e cron)
  const { data: claimed, error: claimErr } = await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: undefined as any, // placeholder, replaced abaixo
    })
    .eq("id", queueId)
    .eq("status", "received")
    .select("*")
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) {
    // Outro worker já pegou. Silenciosamente encerra.
    return { skipped: true, queueId };
  }

  // Reaplica attempts+1 (separado pra evitar default sumir)
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ attempts: (claimed.attempts ?? 0) + 1 })
    .eq("id", queueId);

  const row = claimed as QueueRow;

  try {
    // PASSO 3 — Resolve tenant pelo phone_number_id
    let userId = row.user_id;
    if (!userId) {
      const { data: cfg } = await sb
        .from("whatsapp_config")
        .select("user_id")
        .eq("phone_number_id", row.phone_number_id)
        .eq("is_active", true)
        .maybeSingle();
      userId = cfg?.user_id ?? null;
    }
    if (!userId) {
      await failQueue(row.id, "tenant_not_found");
      return { ok: false, reason: "tenant_not_found" };
    }

    // PASSO 4 — Carrega config do agente DO TENANT
    const { data: agent } = await sb
      .from("whatsapp_cloud_agent_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!agent || !agent.is_active) {
      await failQueue(row.id, "agent_inactive");
      return { ok: false, reason: "agent_inactive" };
    }

    // PASSO 5 — Upsert conversa
    const { data: existingConv } = await sb
      .from("whatsapp_cloud_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", row.from_number)
      .maybeSingle();

    const contactName =
      row.payload?.profile?.name ??
      row.payload?.contacts?.[0]?.profile?.name ??
      existingConv?.contact_name ??
      null;

    let conv = existingConv;
    if (!conv) {
      const { data: created, error: convErr } = await sb
        .from("whatsapp_cloud_conversations")
        .insert({
          user_id: userId,
          contact_number: row.from_number,
          contact_name: contactName,
          status: "active",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (convErr) throw convErr;
      conv = created;
    } else {
      await sb
        .from("whatsapp_cloud_conversations")
        .update({ last_message_at: new Date().toISOString(), contact_name: contactName })
        .eq("id", conv.id);
    }

    const userText = extractText(row.payload);

    // PASSO 6 — Grava inbound
    await sb.from("whatsapp_cloud_messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "inbound",
      sender: "contact",
      content: userText,
      message_type: row.message_type ?? "text",
      wamid: row.wamid,
    });

    // Se handoff: humano no controle, não chama IA
    if (conv.status === "handoff") {
      await doneQueue(row.id);
      return { ok: true, handoff: true };
    }

    // PASSO 8 — Janela 24h
    const { data: lastInbound } = await sb
      .from("whatsapp_cloud_messages")
      .select("created_at")
      .eq("conversation_id", conv.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(2);
    // O insert acima é o mais recente; pegamos o ANTERIOR (índice 1)
    const previousInbound = lastInbound?.[1]?.created_at;
    if (previousInbound) {
      const ageMs = Date.now() - new Date(previousInbound).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        await failQueue(row.id, "outside_24h_window");
        return { ok: false, reason: "outside_24h_window" };
      }
    }

    // PASSO 4.5 — Quota / kill switch
    let { data: quota } = await sb
      .from("ai_messages_quota")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!quota) {
      const ins = await sb
        .from("ai_messages_quota")
        .insert({ user_id: userId })
        .select("*")
        .single();
      quota = ins.data;
    }

    // Reset mensal se passou
    if (quota && new Date(quota.reset_at).getTime() <= Date.now()) {
      const nextReset = new Date();
      nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
      nextReset.setUTCHours(0, 0, 0, 0);
      const r = await sb
        .from("ai_messages_quota")
        .update({ used_count: 0, reset_at: nextReset.toISOString() })
        .eq("user_id", userId)
        .select("*")
        .single();
      quota = r.data;
    }

    if (!quota?.is_enabled) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "ai_disabled");
      return { ok: false, reason: "ai_disabled" };
    }
    if (quota.used_count >= quota.monthly_limit) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "quota_exceeded");
      return { ok: false, reason: "quota_exceeded" };
    }

    // PASSO 7 — Monta prompt do agente DO TENANT (NUNCA mencionar AMZ)
    const personaParts = [
      agent.persona ? `Persona: ${agent.persona}` : null,
      agent.tone ? `Tom de voz: ${agent.tone}` : null,
      agent.knowledge_base ? `Base de conhecimento do negócio:\n${agent.knowledge_base}` : null,
      agent.handoff_rules && Object.keys(agent.handoff_rules ?? {}).length
        ? `Regras de transferência para humano: ${JSON.stringify(agent.handoff_rules)}`
        : null,
      agent.greeting ? `Saudação padrão: ${agent.greeting}` : null,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = [
      `Você é ${agent.agent_name ?? "o atendente virtual"} do negócio do cliente.`,
      personaParts,
      `REGRAS ABSOLUTAS:`,
      `- Você fala EXCLUSIVAMENTE em nome do negócio do cliente.`,
      `- NUNCA mencione "AMZ Ofertas", "Lovable", "IA", "agente virtual", "robô", "automação", ou qualquer tecnologia/plataforma usada.`,
      `- NUNCA revele que você é uma inteligência artificial.`,
      `- Responda como uma pessoa real do atendimento responderia: direto, educado, dentro do escopo do negócio.`,
      `- Se a pergunta fugir do escopo do negócio, peça para a pessoa aguardar e diga que um atendente vai retornar.`,
      `- Seja conciso (idealmente 1-3 frases por resposta).`,
    ].filter(Boolean).join("\n");

    // Histórico recente da conversa (últimas 10 msgs antes desta)
    const { data: histRows } = await sb
      .from("whatsapp_cloud_messages")
      .select("direction, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(11);
    const history = (histRows ?? [])
      .slice(1) // pula a msg atual (recém inserida)
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content as string,
      }));

    // PASSO 9 — IA
    const reply = await callGemini(systemPrompt, history, userText || "(mensagem sem texto)");

    // Incrementa quota
    await sb
      .from("ai_messages_quota")
      .update({ used_count: quota.used_count + 1 })
      .eq("user_id", userId);

    // PASSO 10 — Grava outbound
    const { data: outMsg } = await sb
      .from("whatsapp_cloud_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: "outbound",
        sender: "agent",
        content: reply,
        message_type: "text",
      })
      .select("id")
      .single();

    // PASSO 11 — Envia via whatsapp-send-message
    let sendError: string | null = null;
    try {
      const sentId = await sendWhatsApp(userId, row.from_number, reply);
      if (sentId && outMsg?.id) {
        await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
      }
    } catch (e) {
      sendError = String((e as Error).message ?? e);
    }

    // Atualiza last_message_at
    await sb
      .from("whatsapp_cloud_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    if (sendError) {
      await failQueue(row.id, `send_failed: ${sendError}`);
      return { ok: false, reason: "send_failed", error: sendError };
    }

    // PASSO 12
    await doneQueue(row.id);
    return { ok: true, conversation_id: conv.id, reply_preview: reply.slice(0, 120) };
  } catch (e) {
    // PASSO 13 — Falha. Marca failed; cron pode resgatar processing órfão (não este caso, mas reset segue regra).
    const msg = String((e as Error).message ?? e).slice(0, 500);
    await failQueue(row.id, msg);
    return { ok: false, reason: "exception", error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const queueId = body?.queue_id as string | undefined;

    if (queueId) {
      const result = await processOne(queueId);
      return Response.json(result, { headers: corsHeaders });
    }

    // Sem queue_id: varre fila received (modo cron/manual)
    const { data: pending } = await sb
      .from("whatsapp_cloud_inbound_queue")
      .select("id")
      .eq("status", "received")
      .order("created_at", { ascending: true })
      .limit(20);

    const results: any[] = [];
    for (const p of pending ?? []) {
      results.push(await processOne(p.id));
    }
    return Response.json({ processed: results.length, results }, { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
