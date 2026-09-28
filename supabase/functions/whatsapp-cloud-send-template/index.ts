// ============================================================
// whatsapp-cloud-send-template
// ÚNICA saída de envio outbound do sistema (Meta Cloud API oficial).
// Substitui send-wuzapi-message-pj / send-wuzapi-group-message-pj.
//
// Entrada:
//   {
//     to: "5521999999999",
//     template_id: uuid,
//     user_id?: uuid,          // obrigatório quando chamado com service role
//     variaveis?: string[],    // parâmetros do BODY na ordem {{1}}, {{2}}, ...
//     campanha_id?: uuid,
//     tipo?: string,           // tipo em historico_envios (default 'campanha')
//     registrar?: boolean      // default true — grava historico_envios
//   }
//
// Saída (SEMPRE HTTP 200):
//   { success: true,  message_id }
//   { success: false, motivo, categoria: 'config'|'template'|'token'|'numero'|'rede' }
//
// Regras:
//   - Token/phone_number_id SEMPRE do tenant (whatsapp_config .eq user_id).
//   - Somente template com status_meta='aprovado'.
//   - Nunca fallback para conta admin.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { toMetaSafeImageUrl } from "../_shared/meta-media.ts";
import { logOutboundMessage } from "../_shared/cloud-log.ts";



const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v25.0";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function fail(motivo: string, categoria: string, extra: Record<string, unknown> = {}) {
  return ok({ success: false, motivo, categoria, ...extra });
}

function normalizePhone(raw: string): string | null {
  const only = (raw || "").replace(/\D/g, "");
  if (only.length < 10) return null;
  return only.startsWith("55") ? only : `55${only}`;
}

function dateKeySP(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// Classifica erro da Graph API para o executor decidir pausar ou seguir.
function classifyMetaError(status: number, err: any): "token" | "template" | "numero" | "rede" {
  const code = Number(err?.code ?? 0);
  const sub = Number(err?.error_subcode ?? 0);
  const msg = String(err?.message || "").toLowerCase();

  // Token inválido/expirado, permissão, conta bloqueada → PAUSA a campanha
  if (status === 401 || status === 403) return "token";
  if ([190, 200, 10, 2500].includes(code)) return "token";
  if (sub === 463 || sub === 467) return "token";
  if (msg.includes("access token") || msg.includes("permission") || msg.includes("not authorized")) return "token";

  // Template inexistente/não aprovado/parâmetros errados → PAUSA a campanha
  if (code === 132000 || code === 132001 || code === 132005 || code === 132007 || code === 132012 || code === 132015) {
    return "template";
  }
  if (msg.includes("template")) return "template";

  // Número inválido / sem WhatsApp → apenas pula o contato
  if (code === 131026 || code === 131047 || code === 131051 || code === 1013) return "numero";
  if (msg.includes("not exist") || msg.includes("invalid recipient")) return "numero";

  if (status >= 500 || status === 0) return "rede";
  return "rede";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceCall = bearer === serviceKey;

    const body = await req.json().catch(() => ({}));
    const {
      to,
      template_id,
      variaveis = [],
      campanha_id = null,
      tipo = "campanha",
      registrar = true,
      // Frente 3 — template MARKETING com HEADER: IMAGE + BOTÃO URL dinâmico
      imagem_url = null,   // foto do produto (vai no header)
      link_sufixo = null,  // parte dinâmica do botão URL (ex: caminho/ID do produto)
    } = body ?? {};


    // Cliente admin (leituras cross-tenant controladas por user_id explícito)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // ---------- Resolução do tenant ----------
    let userId: string | null = null;
    if (isServiceCall) {
      userId = body?.user_id ?? null;
      if (!userId) return fail("user_id_obrigatorio_em_chamada_interna", "config");
    } else {
      const authed = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData } = await authed.auth.getUser();
      if (!userData?.user) return fail("nao_autenticado", "config");
      userId = userData.user.id;
    }

    if (!to || !template_id) return fail("parametros_invalidos", "config");

    const telefone = normalizePhone(String(to));
    if (!telefone) return fail("telefone_invalido", "numero");

    // Meta Cloud API NÃO envia para grupos de WhatsApp.
    if (String(to).includes("@g.us")) {
      return fail("grupo_nao_suportado_meta_oficial", "config");
    }

    // ---------- Credenciais do tenant ----------
    const { data: cfg } = await admin
      .from("whatsapp_config")
      .select("phone_number_id, access_token, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (!cfg?.is_active || !cfg.phone_number_id || !cfg.access_token) {
      return fail("whatsapp_nao_conectado", "config");
    }

    // ---------- Template aprovado ----------
    const { data: tpl } = await admin
      .from("whatsapp_templates")
      .select("id, nome_meta, idioma, tipo_uso, status_meta")
      .eq("id", template_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!tpl) return fail("template_nao_encontrado", "template");
    if (tpl.status_meta !== "aprovado") {
      return fail("template_nao_aprovado", "template", { status_meta: tpl.status_meta });
    }

    // ---------- POST Meta ----------
    const components: any[] = [];

    // HEADER: IMAGE — sempre convertida para JPEG (a Meta não entrega AVIF).
    if (imagem_url) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: toMetaSafeImageUrl(String(imagem_url)) } }],
      });
    }

    if (Array.isArray(variaveis) && variaveis.length > 0) {
      components.push({
        type: "body",
        parameters: variaveis.map((v: unknown) => ({ type: "text", text: String(v ?? "") })),
      });
    }

    // BOTÃO URL dinâmico (índice 0) — leva o cliente direto ao produto.
    if (link_sufixo) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: String(link_sufixo) }],
      });
    }


    let messageId: string | null = null;
    let motivo = "";
    let categoria: "token" | "template" | "numero" | "rede" = "rede";

    try {
      const r = await fetch(`${META_API}/${cfg.phone_number_id}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfg.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "template",
          template: {
            name: tpl.nome_meta,
            language: { code: tpl.idioma || "pt_BR" },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.messages?.[0]?.id) {
        messageId = j.messages[0].id;
      } else {
        motivo = j?.error?.message || `http_${r.status}`;
        categoria = classifyMetaError(r.status, j?.error);
      }
    } catch (e) {
      motivo = (e as Error).message;
      categoria = "rede";
    }

    // ---------- Auditoria ----------
    if (registrar) {
      try {
        await admin.from("historico_envios").insert({
          user_id: userId,
          campanha_id,
          whatsapp: telefone,
          tipo,
          mensagem: `template:${tpl.nome_meta}`,
          sucesso: !!messageId,
          erro: messageId ? null : motivo,
          envio_dia_sp: dateKeySP(),
          canal: "meta_cloud",
          template_id: tpl.id,
          message_id: messageId,
        });
      } catch (e) {
        console.error("historico_envios insert falhou:", (e as Error).message);
      }
    }

    // ---------- Monitor de conversas (acompanhamento em tempo real) ----------
    if (messageId) {
      const corpo = Array.isArray(variaveis) && variaveis.length > 0
        ? `📣 ${tpl.nome_meta} → ${variaveis.map((v: unknown) => String(v ?? "")).join(" · ")}`
        : `📣 ${tpl.nome_meta}`;
      await logOutboundMessage(admin, {
        userId: userId!,
        phone: telefone,
        content: corpo,
        messageType: "template",
        wamid: messageId,
        sender: "campanha",
      });
    }

    if (!messageId) return fail(motivo || "sem_message_id", categoria);
    return ok({ success: true, message_id: messageId, canal: "meta_cloud" });

  } catch (e) {
    return fail((e as Error).message, "rede");
  }
});
