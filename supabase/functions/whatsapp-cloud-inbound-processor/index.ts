// WhatsApp Cloud — Inbound Processor (Fase 1.2 — Pietro Multimodal)
// Modo AMZ: reconhece Felicio (dono), filtra clientes AMZ, lê imagens e áudios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSystemPrompt, ADMIN_AMZ_USER_ID } from "../_shared/agent-soul.ts";
import { buildAmzContext, STRANGER_MSG } from "../_shared/amz-context.ts";
import { downloadAllMedia, type MediaExtract } from "../_shared/whatsapp-media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const WHATSAPP_PERMANENT_TOKEN = Deno.env.get("WHATSAPP_PERMANENT_TOKEN");
const WHATSAPP_TEST_ACCESS_TOKEN = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN");

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
  if (payload.image?.caption) return payload.image.caption;
  if (payload.video?.caption) return payload.video.caption;
  if (payload.document?.caption) return payload.document.caption;
  return "";
}

function buildUserContent(userText: string, media: MediaExtract[]): any {
  if (media.length === 0) return userText || "(mensagem sem texto)";
  const hasAudio = media.some((m) => m.kind === "audio");
  const hasImage = media.some((m) => m.kind === "image");
  let preface = userText;
  if (!preface) {
    if (hasAudio && hasImage) preface = "O usuário mandou um áudio e uma imagem. ESCUTE o áudio, VEJA a imagem e responda ao que ele pede — não cumprimente sem responder.";
    else if (hasAudio) preface = "O usuário mandou um ÁUDIO de voz. ESCUTE o áudio, entenda o que ele está pedindo e RESPONDA à pergunta dele. Não responda só 'oi' — responda o conteúdo do áudio.";
    else if (hasImage) preface = "O usuário mandou uma imagem/print. ANALISE a imagem e comente/responda baseado no que você vê.";
    else preface = `[o usuário mandou ${media.length} mídia(s)]`;
  } else if (hasAudio) {
    preface = `${userText}\n\n(o usuário também mandou um áudio — ESCUTE e responda ao conteúdo dele)`;
  }
  const parts: any[] = [{ type: "text", text: preface }];
  for (const m of media) {
    if (m.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: `data:${m.mime};base64,${m.base64}` } });
    } else if (m.kind === "audio") {
      const format = m.mime.includes("ogg") ? "ogg"
        : m.mime.includes("mpeg") || m.mime.includes("mp3") ? "mp3"
        : m.mime.includes("wav") ? "wav"
        : m.mime.includes("m4a") || m.mime.includes("mp4") ? "m4a" : "ogg";
      parts.push({ type: "input_audio", input_audio: { data: m.base64, format } });
    }
  }
  return parts;
}

// ============ TOOLS DO PIETRO ============

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GOOGLE_CX = Deno.env.get("GOOGLE_CX");

async function toolConsultarCnpj(cnpj: string): Promise<string> {
  const clean = (cnpj || "").replace(/\D/g, "");
  if (clean.length !== 14) return JSON.stringify({ erro: "CNPJ inválido — precisa ter 14 dígitos" });
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!r.ok) return JSON.stringify({ erro: `CNPJ não encontrado (${r.status})` });
    const d = await r.json();
    return JSON.stringify({
      cnpj: d.cnpj,
      razao_social: d.razao_social,
      nome_fantasia: d.nome_fantasia,
      situacao: d.descricao_situacao_cadastral,
      data_abertura: d.data_inicio_atividade,
      capital_social: d.capital_social,
      porte: d.porte,
      natureza_juridica: d.natureza_juridica,
      cnae_principal: `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}`,
      endereco: `${d.logradouro}, ${d.numero} ${d.complemento ?? ""} - ${d.bairro}, ${d.municipio}/${d.uf} - CEP ${d.cep}`,
      telefone: d.ddd_telefone_1,
      email: d.email,
      socios: (d.qsa ?? []).map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio, entrada: s.data_entrada_sociedade })),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

async function toolPesquisarWeb(query: string): Promise<string> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return JSON.stringify({ erro: "Busca web não configurada" });
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=6&hl=pt-BR`;
    const r = await fetch(url);
    if (!r.ok) return JSON.stringify({ erro: `busca falhou (${r.status})` });
    const d = await r.json();
    const items = (d.items ?? []).map((it: any) => ({
      titulo: it.title,
      link: it.link,
      resumo: it.snippet,
    }));
    return JSON.stringify({ query, resultados: items });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

async function toolBuscarLugaresProximos(
  ctx: { userId: string; fromNumber: string },
  query: string,
  radiusMeters?: number,
): Promise<string> {
  if (!GOOGLE_API_KEY) return JSON.stringify({ erro: "Google API key não configurada" });
  const { data: locRow } = await sb
    .from("whatsapp_user_locations")
    .select("latitude, longitude, address, updated_at")
    .eq("user_id", ctx.userId)
    .eq("contact_number", ctx.fromNumber)
    .maybeSingle();
  if (!locRow) {
    return JSON.stringify({
      erro: "sem_localizacao",
      instrucao: "Peça ao usuário para compartilhar a localização no WhatsApp (📎 → Localização → Enviar localização atual) e tentar de novo.",
    });
  }
  const ageMin = (Date.now() - new Date(locRow.updated_at).getTime()) / 60000;
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.primaryTypeDisplayName,places.googleMapsUri,places.nationalPhoneNumber",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pt-BR",
        regionCode: "BR",
        maxResultCount: 8,
        locationBias: {
          circle: {
            center: { latitude: locRow.latitude, longitude: locRow.longitude },
            radius: Math.min(Math.max(radiusMeters ?? 2000, 200), 20000),
          },
        },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return JSON.stringify({ erro: `places ${r.status}: ${t.slice(0, 200)}` });
    }
    const d = await r.json();
    const lugares = (d.places ?? []).map((p: any) => {
      const dLat = (p.location?.latitude ?? 0) - locRow.latitude;
      const dLng = (p.location?.longitude ?? 0) - locRow.longitude;
      const km = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      return {
        nome: p.displayName?.text,
        tipo: p.primaryTypeDisplayName?.text,
        endereco: p.formattedAddress,
        distancia_km: Number(km.toFixed(2)),
        nota: p.rating,
        avaliacoes: p.userRatingCount,
        aberto_agora: p.currentOpeningHours?.openNow,
        telefone: p.nationalPhoneNumber,
        mapa: p.googleMapsUri,
      };
    });
    return JSON.stringify({
      query,
      origem: { lat: locRow.latitude, lng: locRow.longitude, endereco: locRow.address, idade_minutos: Math.round(ageMin) },
      lugares,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_cnpj",
      description: "Consulta dados oficiais de uma empresa brasileira pelo CNPJ na Receita Federal (via BrasilAPI). Retorna razão social, sócios, endereço, CNAE, capital social e situação cadastral.",
      parameters: {
        type: "object",
        properties: { cnpj: { type: "string", description: "CNPJ com ou sem formatação (14 dígitos)" } },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pesquisar_web",
      description: "Pesquisa no Google e retorna títulos, links e resumos dos resultados. Use para buscar informações atuais, notícias, dados sobre empresas, pessoas, produtos, tendências etc.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Termo de busca no Google" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_lugares_proximos",
      description: "Busca lugares (cafeteria, farmácia, mercado, restaurante, posto, hospital, etc.) próximos à localização que o usuário compartilhou no WhatsApp. Retorna nome, endereço, distância, avaliação e se está aberto. Se o usuário nunca compartilhou localização, retorna erro pedindo pra ele mandar via 📎 → Localização.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Tipo de lugar em linguagem natural, ex: 'cafeteria', 'farmácia 24h', 'hamburgueria', 'mercado'" },
          radius_meters: { type: "number", description: "Raio de busca em metros (padrão 2000, máx 20000)" },
        },
        required: ["query"],
      },
    },
  },
];

async function runTool(
  name: string,
  args: any,
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (name === "consultar_cnpj") return await toolConsultarCnpj(args?.cnpj ?? "");
  if (name === "pesquisar_web") return await toolPesquisarWeb(args?.query ?? "");
  if (name === "buscar_lugares_proximos") return await toolBuscarLugaresProximos(ctx, args?.query ?? "", args?.radius_meters);
  return JSON.stringify({ erro: `ferramenta ${name} não existe` });
}


async function callGemini(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userContent: any,
  hasMedia: boolean,
  toolCtx: { userId: string; fromNumber: string },
): Promise<string> {
  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userContent },
  ];

  // Modelo pro é mais confiável com áudio/imagem
  const model = hasMedia ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

  for (let step = 0; step < 4; step++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        tools: TOOLS,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      messages.push(msg);
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
        console.log(`[pietro][tool] ${name}`, args);
        const result = await runTool(name, args, toolCtx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    return msg?.content ?? "";
  }
  return "Desculpa, não consegui concluir a pesquisa agora.";
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
  const { data: claimed, error: claimErr } = await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: undefined as any,
    })
    .eq("id", queueId)
    .eq("status", "received")
    .select("*")
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) return { skipped: true, queueId };

  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ attempts: (claimed.attempts ?? 0) + 1 })
    .eq("id", queueId);

  const row = claimed as QueueRow;

  try {
    // PASSO 3 — Resolve tenant + access_token
    let userId = row.user_id;
    let waAccessToken: string | null = null;
    const { data: cfg } = await sb
      .from("whatsapp_config")
      .select("user_id, access_token, connection_method, phone_number_id")
      .eq("phone_number_id", row.phone_number_id)
      .eq("is_active", true)
      .maybeSingle();
    if (cfg) {
      if (!userId) userId = cfg.user_id;
      const isSystemUserTenant = cfg.connection_method === "system_user_permanent";
      waAccessToken = isSystemUserTenant && (WHATSAPP_PERMANENT_TOKEN || WHATSAPP_TEST_ACCESS_TOKEN)
        ? (WHATSAPP_PERMANENT_TOKEN || WHATSAPP_TEST_ACCESS_TOKEN)!
        : cfg.access_token ?? null;
    }
    if (!userId) {
      await failQueue(row.id, "tenant_not_found");
      return { ok: false, reason: "tenant_not_found" };
    }

    // PASSO 4 — Config do agente
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
    let inboundContent = userText || `(${row.message_type ?? "mídia"} sem legenda)`;

    // Captura localização compartilhada
    const loc = row.payload?.location;
    if (loc?.latitude != null && loc?.longitude != null) {
      await sb.from("whatsapp_user_locations").upsert({
        user_id: userId,
        contact_number: row.from_number,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        name: loc.name ?? null,
        address: loc.address ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,contact_number" });
      inboundContent = `📍 Localização compartilhada${loc.name ? ` (${loc.name})` : ""}${loc.address ? ` — ${loc.address}` : ""} [${loc.latitude}, ${loc.longitude}]`;
      console.log(`[processor] location saved for ${row.from_number}`);
    }

    // PASSO 6 — Grava inbound
    await sb.from("whatsapp_cloud_messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "inbound",
      sender: "contact",
      content: inboundContent,
      message_type: row.message_type ?? "text",
      wamid: row.wamid,
    });

    if (conv.status === "handoff") {
      await doneQueue(row.id);
      return { ok: true, handoff: true };
    }

    // PASSO 6.5 — Modo AMZ: 3 níveis de acesso
    const isAmzMode =
      (agent as any).agent_mode === "amz" && userId === ADMIN_AMZ_USER_ID;
    let amzContextBlock: string | undefined;
    if (isAmzMode) {
      const amzCtx = await buildAmzContext(sb, row.from_number);
      console.log(`[processor][amz] from=${row.from_number} access=${amzCtx.access}`);

      if (amzCtx.access === "stranger") {
        try {
          await sendWhatsApp(userId, row.from_number, STRANGER_MSG);
          await sb.from("whatsapp_cloud_messages").insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: STRANGER_MSG,
            message_type: "text",
          });
        } catch (e) {
          console.error("[processor][amz] stranger send falhou:", e);
        }
        await doneQueue(row.id);
        return { ok: true, amz_access: "stranger" };
      }
      amzContextBlock = amzCtx.block;
    }

    // PASSO 8 — Janela 24h
    const { data: lastInbound } = await sb
      .from("whatsapp_cloud_messages")
      .select("created_at")
      .eq("conversation_id", conv.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(2);
    const previousInbound = lastInbound?.[1]?.created_at;
    if (previousInbound) {
      const ageMs = Date.now() - new Date(previousInbound).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        await failQueue(row.id, "outside_24h_window");
        return { ok: false, reason: "outside_24h_window" };
      }
    }

    // PASSO 4.5 — Quota
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

    // PASSO 6.7 — Baixa mídias
    let media: MediaExtract[] = [];
    if (waAccessToken && ["image", "audio", "video", "document"].includes(row.message_type ?? "")) {
      media = await downloadAllMedia(row.payload, waAccessToken);
      console.log(`[processor] media baixadas: ${media.length}`);
    }

    // PASSO 7 — System prompt (com contexto AMZ se aplicável)
    const { systemPrompt, mode } = await buildSystemPrompt(
      sb,
      {
        user_id: userId,
        agent_mode: (agent as any).agent_mode,
        agent_name: agent.agent_name,
        persona: agent.persona,
        tone: agent.tone,
        greeting: agent.greeting,
        knowledge_base: agent.knowledge_base,
        handoff_rules: agent.handoff_rules,
        is_active: agent.is_active,
      },
      userText || "",
      amzContextBlock,
    );
    console.log(`[processor] tenant=${userId} mode=${mode} promptLen=${systemPrompt.length}`);

    // Histórico
    const { data: histRows } = await sb
      .from("whatsapp_cloud_messages")
      .select("direction, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(11);
    const history = (histRows ?? [])
      .slice(1)
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content as string,
      }));

    // PASSO 9 — IA (multimodal)
    const userContent = buildUserContent(userText, media);
    const reply = await callGemini(systemPrompt, history, userContent, media.length > 0, { userId, fromNumber: row.from_number });

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

    // PASSO 11 — Envia
    let sendError: string | null = null;
    try {
      const sentId = await sendWhatsApp(userId, row.from_number, reply);
      if (sentId && outMsg?.id) {
        await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
      }
    } catch (e) {
      sendError = String((e as Error).message ?? e);
    }

    await sb
      .from("whatsapp_cloud_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    if (sendError) {
      await failQueue(row.id, `send_failed: ${sendError}`);
      return { ok: false, reason: "send_failed", error: sendError };
    }

    await doneQueue(row.id);
    return { ok: true, conversation_id: conv.id, reply_preview: reply.slice(0, 120) };
  } catch (e) {
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
