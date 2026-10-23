import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadGestaoAuthContext } from "./gestao-auth-phone.ts";
import {
  montarVariaveisTemplateGiroResumo,
  type GiroResumoAgregado,
} from "./giro-resumo-mensagem.ts";
import { normalizeOwnerPhone } from "./owner-phone.ts";
import { isInsideWhatsAppWindow } from "./whatsapp-marketing-campaign.ts";

export type GiroResumoSendMode = "texto_livre" | "template" | "bloqueado";

export function decidirModoEnvioResumo(
  lastInboundAt: string | null,
  hasApprovedTemplate: boolean,
  now = Date.now(),
): GiroResumoSendMode {
  if (isInsideWhatsAppWindow(lastInboundAt, now)) return "texto_livre";
  if (hasApprovedTemplate) return "template";
  return "bloqueado";
}

export async function listarDestinatariosGiroResumo(
  sb: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const ctx = await loadGestaoAuthContext(sb, userId);
  const phones = new Set<string>();
  for (const p of [ctx.ownerPhone, ...ctx.ownerAltPhones, ...ctx.gestores]) {
    const n = normalizeOwnerPhone(String(p ?? ""));
    if (n) phones.add(n);
  }
  return [...phones];
}

async function lastInboundAt(
  sb: SupabaseClient,
  userId: string,
  phone: string,
): Promise<string | null> {
  const { data: conv } = await sb.from("whatsapp_cloud_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_number", phone)
    .maybeSingle();
  if (!conv?.id) return null;
  const { data: inbound } = await sb.from("whatsapp_cloud_messages")
    .select("created_at")
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return inbound?.created_at ?? null;
}

async function resolveTemplateId(
  sb: SupabaseClient,
  userId: string,
): Promise<{ id: string; nome_meta: string } | null> {
  const preferred = Deno.env.get("GESTAO_GIRO_RESUMO_TEMPLATE_NOME")?.trim()
    || "gestao_giro_resumo_v1";
  const { data: exact } = await sb.from("whatsapp_templates")
    .select("id, nome_meta")
    .eq("user_id", userId)
    .eq("nome_meta", preferred)
    .eq("status_meta", "aprovado")
    .maybeSingle();
  if (exact?.id) return exact as { id: string; nome_meta: string };
  const { data: fallback } = await sb.from("whatsapp_templates")
    .select("id, nome_meta")
    .eq("user_id", userId)
    .eq("tipo_uso", "transacional")
    .eq("status_meta", "aprovado")
    .ilike("nome_meta", "%giro%resumo%")
    .limit(1)
    .maybeSingle();
  return fallback?.id ? fallback as { id: string; nome_meta: string } : null;
}

export type GiroResumoSendResult = {
  phone: string;
  ok: boolean;
  mode: GiroResumoSendMode;
  templateNome?: string;
  error?: string;
};

export async function enviarGiroResumoWhatsApp(
  sb: SupabaseClient,
  input: {
    supabaseUrl: string;
    serviceKey: string;
    userId: string;
    phone: string;
    message: string;
    agregado?: GiroResumoAgregado;
    hojeYmd?: string;
  },
): Promise<GiroResumoSendResult> {
  const phone = normalizeOwnerPhone(input.phone);
  if (!phone) {
    return { phone: input.phone, ok: false, mode: "bloqueado", error: "telefone inválido" };
  }
  const inbound = await lastInboundAt(sb, input.userId, phone);
  const tpl = await resolveTemplateId(sb, input.userId);
  const mode = decidirModoEnvioResumo(inbound, !!tpl);

  if (mode === "bloqueado") {
    return {
      phone,
      ok: false,
      mode,
      error: "fora da janela 24h sem template aprovado",
    };
  }

  if (mode === "texto_livre") {
    const res = await fetch(`${input.supabaseUrl}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.serviceKey}`,
        apikey: input.serviceKey,
      },
      body: JSON.stringify({
        user_id: input.userId,
        to: phone,
        message: input.message,
        log_sender: "agent",
      }),
    });
    const j = await res.json().catch(() => ({}));
    const ok = res.ok && j?.success === true;
    return {
      phone,
      ok,
      mode,
      error: ok ? undefined : String(j?.error ?? j?.message ?? res.status),
    };
  }

  const res = await fetch(`${input.supabaseUrl}/functions/v1/whatsapp-cloud-send-template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.serviceKey}`,
      apikey: input.serviceKey,
    },
    body: JSON.stringify({
      user_id: input.userId,
      to: phone,
      template_id: tpl!.id,
      variaveis: input.agregado && input.hojeYmd
        ? [...montarVariaveisTemplateGiroResumo(input.agregado, input.hojeYmd)]
        : [input.message.slice(0, 900)],
      tipo: "gestao_giro_resumo",
      registrar: true,
    }),
  });
  const j = await res.json().catch(() => ({}));
  const ok = j?.success === true;
  return {
    phone,
    ok,
    mode,
    templateNome: tpl!.nome_meta,
    error: ok ? undefined : String(j?.motivo ?? j?.error ?? "template falhou"),
  };
}
