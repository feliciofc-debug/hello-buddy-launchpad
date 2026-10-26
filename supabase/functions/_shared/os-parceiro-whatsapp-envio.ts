import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isInsideWhatsAppWindow } from "./whatsapp-marketing-campaign.ts";
import { normalizeOwnerPhone } from "./owner-phone.ts";
import { buildGestaoOsCotacaoWhatsappPdfBytes } from "./os-parceiro-cotacao-pdf.ts";
import type { GestaoOsCotacaoPdfInput } from "./gestao-os-cotacao-pdf.ts";
import {
  OS_COT_WA_BTN_ENVIAR,
  OS_COT_WA_BTN_SEM_AGENDA,
} from "./os-parceiro-interactive.ts";
import {
  gestaoOsFotosParaPdf,
  type GestaoOsFotoRefRow,
} from "./gestao-os-fotos.ts";
import {
  gestaoTrocaFotoIsCrlv,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";
import { toMetaSafeImageUrl } from "./meta-media.ts";

export type OsCotacaoEnvioResult = {
  cotacaoId: string;
  ok: boolean;
  mode: "documento_janela" | "convite" | "preview" | "pendente_modelo" | "falhou";
  error?: string;
  pdfUrl?: string;
};

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

async function resolveCotacaoConviteTemplate(
  sb: SupabaseClient,
  userId: string,
): Promise<{ id: string; nome_meta: string } | null> {
  const preferred = Deno.env.get("OS_COTACAO_CONVITE_TEMPLATE_NOME")?.trim()
    || "os_cotacao_convite_v1";
  const { data: exact } = await sb.from("whatsapp_templates")
    .select("id, nome_meta")
    .eq("user_id", userId)
    .eq("nome_meta", preferred)
    .eq("status_meta", "aprovado")
    .maybeSingle();
  if (exact?.id) return exact as { id: string; nome_meta: string };
  return null;
}

export function montarVariaveisTemplateCotacao(input: {
  lojaNome: string;
  osNumero: number;
  veiculoLabel: string;
  parceiroNome: string;
}): string[] {
  return [
    input.lojaNome.slice(0, 60),
    `OS ${input.osNumero}`.slice(0, 30),
    input.veiculoLabel.slice(0, 60),
    input.parceiroNome.slice(0, 40),
  ];
}

async function sendWhatsAppPayload(
  supabaseUrl: string,
  serviceKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(txt); } catch { /* ignore */ }
  const ok = res.ok && j?.success === true;
  return {
    ok,
    messageId: String(j?.message_id ?? j?.wamid ?? "") || undefined,
    error: ok ? undefined : String(j?.error ?? j?.message ?? txt.slice(0, 200)),
  };
}

export async function enviarPedidoCotacaoParceiroWhatsApp(
  sb: SupabaseClient,
  input: {
    supabaseUrl: string;
    serviceKey: string;
    userId: string;
    cotacaoId: string;
    pdfInput: GestaoOsCotacaoPdfInput;
    parceiroPhone: string;
    parceiroNome: string;
    osId: string;
    osNumero: number;
    veiculoLabel: string;
    lojaNome: string;
    fotoRefs?: GestaoOsFotoRefRow[];
    trocaFotosRaw?: unknown;
    forceDirect?: boolean;
    previewOnly?: boolean;
    logoUrl?: string | null;
  },
): Promise<OsCotacaoEnvioResult> {
  const phone = normalizeOwnerPhone(input.parceiroPhone);
  if (!phone) {
    return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: "WhatsApp do parceiro inválido" };
  }

  const trocaFotos = normalizeGestaoTrocaFotos(input.trocaFotosRaw);
  const fotosPdf = gestaoOsFotosParaPdf(input.fotoRefs ?? [], trocaFotos);
  for (const f of fotosPdf) {
    const etiqueta = trocaFotos.find((x) => x.path === f.storage_path)?.etiqueta ?? "";
    if (gestaoTrocaFotoIsCrlv({ etiqueta })) {
      return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: "CRLV não pode ir no PDF" };
    }
  }

  const fotosComUrl: { url: string; legenda: string }[] = [];
  for (const [index, foto] of fotosPdf.slice(0, 12).entries()) {
    const origem = foto.origem ?? "troca";
    let url = foto.storage_path;
    if (!/^https?:\/\//i.test(url)) {
      const bucket = origem === "os"
        ? "gestao-os-documentos"
        : origem === "anuncio"
        ? "produtos"
        : "trocas";
      const { data } = await sb.storage.from(bucket).createSignedUrl(url, 3600);
      if (!data?.signedUrl) continue;
      url = data.signedUrl;
    }
    const etiquetaTroca = trocaFotos.find((x) => x.path === foto.storage_path)?.etiqueta;
    fotosComUrl.push({
      url,
      legenda: foto.troca_ia_item_id
        ? (foto.legenda || etiquetaTroca || `Item do laudo ${index + 1}`)
        : origem === "anuncio"
        ? `Foto do anúncio ${index + 1}`
        : origem === "os"
        ? `Foto da OS ${index + 1}`
        : (etiquetaTroca || `Foto da avaliação ${index + 1}`),
    });
  }

  const pdfBytes = await buildGestaoOsCotacaoWhatsappPdfBytes(input.pdfInput, {
    logoUrl: input.logoUrl,
    fotos: fotosComUrl,
    log: (warning) => console.warn("[os-cotacao-pdf]", warning),
  });
  const preview = input.previewOnly === true;
  const path = preview
    ? `${input.userId}/os/${input.osId}/previa/${crypto.randomUUID()}-pedido-cotacao-${input.osNumero}.pdf`
    : `${input.userId}/os/${input.osId}/${crypto.randomUUID()}-pedido-cotacao-${input.osNumero}.pdf`;
  const { error: upErr } = await sb.storage.from("gestao-os-documentos").upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) {
    return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: upErr.message };
  }

  if (!preview) {
    await sb.from("gestao_os_documento").insert({
      user_id: input.userId,
      os_id: input.osId,
      tipo: "pedido_cotacao",
      storage_path: path,
      mime_type: "application/pdf",
      tamanho_bytes: pdfBytes.byteLength,
    });
  }

  const signedTtl = preview ? 600 : 3600;
  const { data: signed } = await sb.storage.from("gestao-os-documentos")
    .createSignedUrl(path, signedTtl);
  const docUrl = signed?.signedUrl;
  if (!docUrl) {
    return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: "URL do PDF indisponível" };
  }

  if (input.previewOnly) {
    return {
      cotacaoId: input.cotacaoId,
      ok: true,
      mode: "preview",
      pdfUrl: docUrl,
    };
  }

  const inbound = await lastInboundAt(sb, input.userId, phone);
  const tpl = await resolveCotacaoConviteTemplate(sb, input.userId);
  const inWindow = input.forceDirect === true || isInsideWhatsAppWindow(inbound);

  const instrucoes =
    "Como responder:\n" +
    "1) Toque em *Enviar orçamento* (valor → prazo → observação)\n" +
    "2) Texto livre: ex. R$ 1.950, 7 dias\n" +
    "3) PDF ou foto do orçamento\n" +
    "4) Áudio\n\n" +
    "Antes de registrar, pedimos confirmação [Sim] ou [Corrigir].";

  let messageId: string | undefined;
  let mode: OsCotacaoEnvioResult["mode"] = "falhou";

  if (inWindow) {
    const docSend = await sendWhatsAppPayload(input.supabaseUrl, input.serviceKey, {
      user_id: input.userId,
      to: phone,
      message: `Pedido de cotação — OS #${input.osNumero}`,
      document_url: docUrl,
      document_filename: `pedido-os-${input.osNumero}.pdf`,
    });
    if (!docSend.ok) {
      return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: docSend.error };
    }
    messageId = docSend.messageId;
    for (const foto of fotosComUrl.slice(0, 10)) {
      const imageSend = await sendWhatsAppPayload(input.supabaseUrl, input.serviceKey, {
        user_id: input.userId,
        to: phone,
        message: foto.legenda.slice(0, 120),
        image_url: toMetaSafeImageUrl(foto.url) ?? foto.url,
      });
      if (!imageSend.ok) {
        console.warn("[os-cotacao-wa] foto avulsa falhou:", imageSend.error);
      }
    }
    const btn = await sendWhatsAppPayload(input.supabaseUrl, input.serviceKey, {
      user_id: input.userId,
      to: phone,
      message: instrucoes,
      send_text_first: true,
      interactive_buttons: {
        body: "Escolha uma opção:",
        buttons: [
          { id: OS_COT_WA_BTN_ENVIAR, title: "Enviar orçamento" },
          { id: OS_COT_WA_BTN_SEM_AGENDA, title: "Não tenho agenda" },
        ],
      },
    });
    if (!btn.ok) {
      return { cotacaoId: input.cotacaoId, ok: false, mode: "falhou", error: btn.error };
    }
    mode = "documento_janela";
  } else if (tpl) {
    const tplSend = await fetch(`${input.supabaseUrl}/functions/v1/whatsapp-cloud-send-template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.serviceKey}`,
        apikey: input.serviceKey,
      },
      body: JSON.stringify({
        user_id: input.userId,
        to: phone,
        template_id: tpl.id,
        variaveis: [
          input.parceiroNome.replace(/\s+/g, " ").slice(0, 40),
          input.lojaNome.replace(/\s+/g, " ").slice(0, 60),
          input.veiculoLabel.replace(/\s+/g, " ").slice(0, 60),
        ],
        quick_reply_payloads: [
          `os_cot_wa:aceite:${input.cotacaoId}`,
          `os_cot_wa:sem_agenda:${input.cotacaoId}`,
        ],
        tipo: "os_cotacao_convite",
        registrar: true,
      }),
    });
    const j = await tplSend.json().catch(() => ({}));
    if (!tplSend.ok || j?.success !== true) {
      return {
        cotacaoId: input.cotacaoId,
        ok: false,
        mode: "falhou",
        error: String(j?.motivo ?? j?.error ?? "template falhou"),
      };
    }
    messageId = String(j?.message_id ?? "") || undefined;
    await sb.rpc("gestao_os_cotacao_marcar_envio_whatsapp", {
      p_cotacao_id: input.cotacaoId,
      p_status: "convite_enviado",
      p_message_id: messageId ?? null,
    });
    await sb.from("gestao_os_evento").insert({
      user_id: input.userId,
      os_id: input.osId,
      tipo: "cotacao",
      origem: "whatsapp_parceiro",
      mensagem: `Convite de cotação enviado via WhatsApp para ${input.parceiroNome}.`,
    });
    return { cotacaoId: input.cotacaoId, ok: true, mode: "convite" };
  } else {
    await sb.rpc("gestao_os_cotacao_marcar_envio_whatsapp", {
      p_cotacao_id: input.cotacaoId,
      p_status: "pendente_modelo",
      p_pendente_motivo: "Ative o convite de cotação em Operações → Configurar",
    });
    await sb.from("gestao_os_evento").insert({
      user_id: input.userId,
      os_id: input.osId,
      tipo: "cotacao",
      origem: "whatsapp_parceiro",
      mensagem: `Pedido para ${input.parceiroNome}: envio pendente; ative o convite de cotação em Operações → Configurar.`,
    });
    return { cotacaoId: input.cotacaoId, ok: false, mode: "pendente_modelo" };
  }

  const { data: conv } = await sb.from("whatsapp_cloud_conversations")
    .select("id")
    .eq("user_id", input.userId)
    .eq("contact_number", phone)
    .maybeSingle();

  await sb.rpc("gestao_os_cotacao_marcar_envio_whatsapp", {
    p_cotacao_id: input.cotacaoId,
    p_status: "enviado",
    p_message_id: messageId ?? null,
    p_conversation_id: conv?.id ?? null,
  });

  await sb.from("gestao_os_evento").insert({
    user_id: input.userId,
    os_id: input.osId,
    tipo: "cotacao",
    origem: "whatsapp_parceiro",
    mensagem: `Pedido de cotação enviado via WhatsApp para ${input.parceiroNome}.`,
  });

  return { cotacaoId: input.cotacaoId, ok: true, mode };
}
