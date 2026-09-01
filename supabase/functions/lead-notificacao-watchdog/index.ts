// ============================================================
// lead-notificacao-watchdog
// Rede de segurança (camada 4) do encaminhamento de leads.
//
// Objetivo: garantir que NENHUM lead atendido pelo agente fique sem aviso
// entregue ao dono do tenant — mesmo que a IA não chame a tool, mesmo que o
// processador falhe, mesmo que a Meta recuse o envio na hora.
//
// Como funciona (roda de 10 em 10 minutos via pg_cron):
//  1. Lista conversas com mensagem do CLIENTE nas últimas 12h (todos tenants).
//  2. Ignora o próprio dono e mensagens irrelevantes ("ok", "obrigado", emoji).
//  3. Verifica em lead_encaminhamentos se a Meta confirmou ENTREGUE/LIDA.
//  4. Se não existir, envia o aviso ao dono AGORA e registra o comprovante.
//
// Só registra sucesso com message_id real da Meta — nunca confirma no vácuo.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveTenantOwner } from "../_shared/amz-context.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const JANELA_MS = 12 * 60 * 60 * 1000; // olha 12h para trás
const GRACE_MS = 4 * 60 * 1000; // dá 4 min para o fluxo normal resolver sozinho
const MAX_POR_RODADA = 40;

const digits = (v: string) => String(v || "").replace(/\D/g, "");

// Mensagem de lead "de verdade": tem conteúdo, não é só cortesia/emoji.
function ehMensagemRelevante(raw: string): boolean {
  const t = String(raw || "").trim();
  if (t.length < 8) return false;
  if (/^(ok|okay|blz|beleza|obrigad[oa]|valeu|vlw|bom dia|boa tarde|boa noite|oi|ol[áa]|opa|tchau|👍|🙏|❤️)+[.!]*$/i.test(t)) return false;
  return /[a-zA-Z0-9]/.test(t);
}

async function sendWhatsApp(user_id: string, to: string, message: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ user_id, to, message }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`send ${res.status}: ${txt.slice(0, 200)}`);
  let j: any = null;
  try {
    j = JSON.parse(txt);
  } catch {
    throw new Error(`send_invalid_response: ${txt.slice(0, 160)}`);
  }
  const messageId = j?.message_id ?? j?.wamid ?? null;
  if (j?.success !== true || !messageId) {
    throw new Error(`send_without_delivery_receipt: ${txt.slice(0, 160)}`);
  }
  return String(messageId);
}

function protocolo(wamid: string): string {
  const base = digits(wamid) || String(Date.now());
  const code = base.slice(-6).padStart(6, "0");
  return `#${code}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  const desde = new Date(inicio - JANELA_MS).toISOString();
  const ate = new Date(inicio - GRACE_MS).toISOString();
  const resultado = { verificados: 0, resgatados: 0, falhas: 0, detalhes: [] as unknown[] };

  try {
    // Conversas com atividade recente do cliente
    const { data: convs, error: errConvs } = await sb
      .from("whatsapp_cloud_conversations")
      .select("id, user_id, contact_number, contact_name, last_message_at")
      .gte("last_message_at", desde)
      .lte("last_message_at", ate)
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (errConvs) throw errConvs;

    for (const conv of convs || []) {
      if (resultado.resgatados >= MAX_POR_RODADA) break;
      const telefone = digits(conv.contact_number);
      if (!telefone) continue;

      const owner = await resolveTenantOwner(sb, conv.user_id);
      if (!owner.phone) continue;
      if (digits(owner.phone) === telefone) continue; // é o próprio dono

      // Última mensagem do cliente nessa conversa
      const { data: msgs } = await sb
        .from("whatsapp_cloud_messages")
        .select("content, message_type, created_at")
        .eq("conversation_id", conv.id)
        .eq("direction", "inbound")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!msgs?.length) continue;

      const relevante = msgs.find(
        (m) => m.message_type !== "text" || ehMensagemRelevante(String(m.content || "")),
      );
      if (!relevante) continue;

      resultado.verificados++;

      // Só considera resolvido quando a Meta confirmou entregue/lida.
      const { data: enc } = await sb
        .from("lead_encaminhamentos")
        .select("id, wamid_dono, enviado_em, status_entrega")
        .eq("user_id", conv.user_id)
        .eq("telefone", telefone)
        .gte("enviado_em", desde)
        .in("status_entrega", ["entregue", "lida"])
        .limit(1);
      if (enc?.length) continue; // tudo certo, dono já foi avisado

      // Resgate: avisa o dono agora
      const nome = (conv.contact_name || "").trim();
      const trecho = String(relevante.content || "").replace(/\s+/g, " ").slice(0, 300);
      const aviso = [
        "🔔 *Contato de cliente no WhatsApp*",
        "",
        `Nome: ${nome || "não informado"}`,
        `Telefone: +${telefone}`,
        trecho ? `Mensagem: ${trecho}` : `Mensagem: (${relevante.message_type})`,
        "",
        `Falar agora: https://wa.me/${telefone}`,
      ].join("\n");

      try {
        const messageId = await sendWhatsApp(conv.user_id, owner.phone, aviso);
        const proto = protocolo(messageId);
        await sb.from("lead_encaminhamentos").insert({
          user_id: conv.user_id,
          telefone,
          nome: nome || null,
          mensagem: trecho || null,
          protocolo: proto,
          wamid_dono: messageId,
          destino_dono: owner.phone,
          status_entrega: "aceita",
          status_atualizado_em: new Date().toISOString(),
          enviado_em: new Date().toISOString(),
        });
        resultado.resgatados++;
        resultado.detalhes.push({ user_id: conv.user_id, telefone, protocolo: proto, wamid: messageId });
        console.log(`[watchdog][resgate] tenant=${conv.user_id} lead=${telefone} proto=${proto}`);
      } catch (e) {
        resultado.falhas++;
        const detalhe = String((e as Error).message).slice(0, 200);
        resultado.detalhes.push({ user_id: conv.user_id, telefone, erro: detalhe });
        console.error(`[watchdog][falha] tenant=${conv.user_id} lead=${telefone} erro=${detalhe}`);
      }
    }

    return new Response(JSON.stringify({ success: true, ms: Date.now() - inicio, ...resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[watchdog] erro geral:", (e as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: String((e as Error).message).slice(0, 300) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
