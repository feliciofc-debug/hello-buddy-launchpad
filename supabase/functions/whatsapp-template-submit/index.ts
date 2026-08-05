// Fase 2 · Bloco A — Submete um template do tenant à Meta Cloud API.
// Token e waba_id lidos de whatsapp_config do próprio user_id (JWT). Nunca env global.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v25.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Convenção do projeto: erros de API externa retornam HTTP 200 com {success:false}.
function metaError(msg: string, details?: unknown) {
  return json(200, { success: false, error: msg, details: details ?? null });
}

function buildComponents(tpl: any): any[] {
  const components: any[] = [];

  // HEADER opcional
  const header = tpl.header && typeof tpl.header === "object" ? tpl.header : null;
  if (header && header.format) {
    if (header.format === "TEXT" && header.text) {
      components.push({ type: "HEADER", format: "TEXT", text: String(header.text) });
    } else if (header.format === "IMAGE" && header.example_url) {
      components.push({
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: [String(header.example_url)] },
      });
    }
  }

  // BODY (com exemplos obrigatórios quando há variáveis {{n}})
  const bodyText = String(tpl.body_text ?? "");
  const varNums = [...new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))]
    .sort((a, b) => a - b);
  const bodyComp: any = { type: "BODY", text: bodyText };
  if (varNums.length > 0) {
    const map = tpl.variaveis_map && typeof tpl.variaveis_map === "object" ? tpl.variaveis_map : {};
    const fallback: Record<string, string> = {
      nome: "Maria",
      produto: "Kit Skincare Facial",
      preco: "R$ 89,90",
      preco_brl: "R$ 89,90",
    };
    const examples = varNums.map((n) => {
      const entry = (map as any)[String(n)];
      if (entry && typeof entry === "object") {
        if (entry.exemplo) return String(entry.exemplo);
        if (entry.campo && fallback[entry.campo]) return fallback[entry.campo];
      }
      if (typeof entry === "string" && fallback[entry]) return fallback[entry];
      return "Exemplo";
    });
    bodyComp.example = { body_text: [examples] };
  }
  components.push(bodyComp);

  // BOTÕES
  if (tpl.tipo_uso === "convite_optin") {
    // Textos combinados com o gate de opt-in (aceita qualquer botão que comece
    // com "Sim" → confirma; "Não" → recusa/stop).
    components.push({
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "Sim, quero!" },
        { type: "QUICK_REPLY", text: "Não, obrigado" },
      ],
    });
  } else if (Array.isArray(tpl.botoes) && tpl.botoes.length > 0) {
    const buttons = tpl.botoes
      .map((b: any) => {
        if (!b || !b.type) return null;
        if (b.type === "URL" && b.text && b.url) {
          return { type: "URL", text: String(b.text), url: String(b.url) };
        }
        if (b.type === "PHONE_NUMBER" && b.text && b.phone_number) {
          return { type: "PHONE_NUMBER", text: String(b.text), phone_number: String(b.phone_number) };
        }
        if (b.type === "QUICK_REPLY" && b.text) {
          return { type: "QUICK_REPLY", text: String(b.text) };
        }
        return null;
      })
      .filter(Boolean);
    if (buttons.length > 0) components.push({ type: "BUTTONS", buttons });
  }

  return components;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing Authorization" });

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
  const userId = userData.user.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const templateId = payload?.template_id;
  if (!templateId) return json(400, { error: "template_id obrigatório" });

  // 1) Template
  const { data: tpl, error: tplErr } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();
  if (tplErr) return json(500, { error: tplErr.message });
  if (!tpl) return json(404, { error: "Template não encontrado" });
  if (tpl.status_meta !== "rascunho") {
    return json(400, { error: `Template não está em rascunho (status atual: ${tpl.status_meta})` });
  }

  // 2) Config do tenant
  const { data: cfg, error: cfgErr } = await supabaseAdmin
    .from("whatsapp_config")
    .select("waba_id, access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (cfgErr) return json(500, { error: cfgErr.message });
  if (!cfg?.waba_id || !cfg?.access_token) {
    return json(400, { error: "Conecte o WhatsApp Cloud antes de cadastrar templates (waba_id/access_token ausentes)." });
  }

  // 3) Body Meta
  const body = {
    name: tpl.nome_meta,
    language: tpl.idioma,
    category: tpl.categoria_meta,
    components: buildComponents(tpl),
  };

  // 4) POST Meta
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.waba_id}/message_templates`;
  const metaRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const metaJson = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok || metaJson?.error) {
    console.error("[template-submit] Meta error", metaJson);
    return metaError(metaJson?.error?.message ?? "Erro ao submeter à Meta", metaJson);
  }

  // 5) Atualiza
  const metaTemplateId = metaJson?.id ? String(metaJson.id) : null;
  const statusMeta = (metaJson?.status ?? "PENDING").toString().toUpperCase() === "APPROVED"
    ? "aprovado"
    : "pendente";

  const { error: upErr } = await supabaseAdmin
    .from("whatsapp_templates")
    .update({
      meta_template_id: metaTemplateId,
      status_meta: statusMeta,
      motivo_rejeicao_meta: null,
      waba_id: cfg.waba_id,
    })
    .eq("id", templateId);
  if (upErr) return json(500, { error: upErr.message });

  return json(200, {
    success: true,
    meta_template_id: metaTemplateId,
    status_meta: statusMeta,
    meta_response: metaJson,
  });
});
