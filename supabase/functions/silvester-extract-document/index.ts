// silvester-extract-document
// Recebe somente texto de conversa do Silvester para atualizar o dossiê.
// Mídia/arquivo é ignorado por contrato de privacidade e nunca vai para IA.
//
// Body: {
//   user_id: string,               // dono do agente (Marcelo)
//   telefone_cliente: string,      // número WhatsApp do cliente
//   nome_cliente?: string,
//   owner_phone?: string,          // Marcelo's phone para notificar
//   media?: Array<{ url: string; mime?: string; wamid?: string; caption?: string }>,
//   texto_conversa?: string,       // últimas mensagens do cliente pra extrair dados
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractSilvesterConversationText } from "./privacy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? Deno.env.get("META_ACCESS_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- Helpers -------------------------------------------------------------

async function getOrCreateDossie(userId: string, telefone: string, nomeCliente?: string) {
  const { data: existing } = await sb
    .from("silvester_dossies")
    .select("*")
    .eq("user_id", userId)
    .eq("telefone_cliente", telefone)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb
    .from("silvester_dossies")
    .insert({ user_id: userId, telefone_cliente: telefone, nome_completo: nomeCliente || null, status: "coletando" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateDossieFields(dossieId: string, patch: Record<string, any>) {
  // remove chaves vazias/null
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  await sb.from("silvester_dossies").update(clean).eq("id", dossieId);
}

async function sendWhatsAppText(toPhone: string, body: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  try {
    await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toPhone, type: "text", text: { body } }),
    });
  } catch (e) {
    console.warn("[silvester] notify owner failed", (e as Error).message);
  }
}

// ---- Handler -------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, telefone_cliente, nome_cliente, owner_phone, texto_conversa } = body ?? {};
    if (!user_id || !telefone_cliente) {
      return new Response(JSON.stringify({ ok: false, error: "missing user_id/telefone_cliente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tenantCfg } = await sb.from("empresa_config")
      .select("silvester_dossie_ativo")
      .eq("user_id", user_id)
      .maybeSingle();
    if (tenantCfg?.silvester_dossie_ativo !== true) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "flag_off" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dossie = await getOrCreateDossie(user_id, telefone_cliente, nome_cliente);
    console.log("[silvester] dossie", dossie.id, "score inicial", dossie.completeness_score);

    // Somente texto digitado na conversa pode seguir para IA. O campo media,
    // mesmo que um chamador legado ainda o envie, é deliberadamente ignorado.
    if (texto_conversa && texto_conversa.trim().length > 20) {
      try {
        const extracted = await extractSilvesterConversationText({
          text: texto_conversa,
          apiKey: LOVABLE_API_KEY,
        });
        console.log("[silvester] texto extracted", Object.keys(extracted));
        await updateDossieFields(dossie.id, extracted);
      } catch (e) {
        console.warn("[silvester] text extraction failed", (e as Error).message);
      }
    }

    // Recarrega dossiê pra pegar score atualizado
    const { data: updated } = await sb.from("silvester_dossies").select("*").eq("id", dossie.id).single();
    if (!updated) return new Response(JSON.stringify({ ok: true, dossie_id: dossie.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 4) Notifica Marcelo em 2 momentos: parcial (>=30 e sem parcial_notified) / completo (>=80 e sem completo_notified)
    const nome = updated.nome_completo || nome_cliente || "cliente";
    const interesse = updated.interesse_bem
      ? `${updated.interesse_bem}${updated.interesse_valor_carta ? ` R$${Number(updated.interesse_valor_carta).toLocaleString("pt-BR")}` : ""}`
      : "consórcio (interesse não detalhado)";

    if (owner_phone && updated.completeness_score >= 30 && !updated.parcial_notified_at) {
      const msg = `🟡 *Silvester — dossiê iniciado*\n\n👤 ${nome}\n📱 ${telefone_cliente}\n🎯 Interesse: ${interesse}\n📊 Completude: ${updated.completeness_score}%\n\nAbra em /dossies pra ver a ficha.`;
      await sendWhatsAppText(owner_phone, msg);
      await sb.from("silvester_dossies").update({ parcial_notified_at: new Date().toISOString() }).eq("id", dossie.id);
    }

    if (owner_phone && updated.completeness_score >= 80 && !updated.completo_notified_at) {
      const msg = `🟢 *Silvester — dossiê COMPLETO*\n\n👤 ${nome}\n📱 ${telefone_cliente}\n🎯 Interesse: ${interesse}\n📊 Completude: ${updated.completeness_score}%\n💰 Renda declarada: ${updated.renda_mensal ? `R$ ${Number(updated.renda_mensal).toLocaleString("pt-BR")}` : "—"}\n📎 Documentos anexados prontos pra proposta.\n\nAbra /dossies pra baixar tudo em .zip.`;
      await sendWhatsAppText(owner_phone, msg);
      await sb.from("silvester_dossies").update({ completo_notified_at: new Date().toISOString(), status: "aguardando_proposta" }).eq("id", dossie.id);
    }

    return new Response(
      JSON.stringify({ ok: true, dossie_id: dossie.id, score: updated.completeness_score, docs_processados: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[silvester-extract-document] error", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
