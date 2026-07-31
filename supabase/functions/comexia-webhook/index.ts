// Edge Function: comexia-webhook
// Webhook EXCLUSIVO do produto "comexia". Não interfere no billing-webhook dos clientes AMZ.
// Fluxo: pagamento aprovado -> grava em comexia_pagamentos -> notifica no WhatsApp.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Número que RECEBE o aviso de pagamento comexia
const DESTINO_NOTIFICACAO = "5521995379550";
// user_id do tenant AMZ cujo whatsapp_config envia (número 5521980804901)
const SENDER_USER_ID = "b7af0118-c506-4f87-8ac3-a0a11fd621fe";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ok = () =>
    new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Extrai payment id (query ou body)
  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams);
  let paymentId: string | null = null;
  if (q.type === "payment" && q["data.id"]) paymentId = q["data.id"];
  else if (q.topic === "payment" && q.id) paymentId = q.id;

  if (!paymentId) {
    try {
      const b = await req.json();
      if (b?.data?.id) paymentId = String(b.data.id);
    } catch { /* body vazio */ }
  }

  if (!paymentId) {
    return new Response(JSON.stringify({ error: "payment id ausente" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const payment = await payResp.json();

    const produto = payment?.metadata?.produto || payment?.external_reference;
    if (produto !== "comexia") {
      console.log("[comexia-webhook] Ignorado (não é comexia):", produto);
      return ok();
    }

    if (payment.status !== "approved") {
      console.log("[comexia-webhook] Pagamento não aprovado:", payment.status);
      return ok();
    }

    // Dedup
    const { data: existente } = await supabase
      .from("comexia_pagamentos")
      .select("id, notificado")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (existente?.notificado) {
      console.log("[comexia-webhook] Já processado:", paymentId);
      return ok();
    }

    const payer = payment.payer || {};
    const nome = [payer.first_name, payer.last_name].filter(Boolean).join(" ").trim() || "(não informado)";
    const email = payer.email || "(não informado)";
    const telefone = payer.phone
      ? `${payer.phone.area_code || ""}${payer.phone.number || ""}`.replace(/\D/g, "")
      : null;
    const documento = payer.identification?.number ? String(payer.identification.number) : null;
    const dataPagamento = payment.date_approved || new Date().toISOString();

    // 1) GRAVA PRIMEIRO (pagamento nunca se perde)
    let registroId = existente?.id ?? null;
    if (!registroId) {
      const { data: inserido, error: insErr } = await supabase
        .from("comexia_pagamentos")
        .insert({
          mp_payment_id: String(paymentId),
          nome,
          email,
          telefone,
          documento,
          amount: payment.transaction_amount,
          status: "approved",
          payment_date: dataPagamento,
          raw: payment,
        })
        .select("id")
        .maybeSingle();
      if (insErr) console.error("[comexia-webhook] Erro ao gravar pagamento:", insErr);
      registroId = inserido?.id ?? null;
    }

    // 2) NOTIFICA (falha aqui não perde a venda)
    try {
      const dataBR = new Date(dataPagamento).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });
      const valorBR = Number(payment.transaction_amount).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const mensagem =
        `🟢 PAGAMENTO COMEXIA\n` +
        `Cliente: ${nome}\n` +
        `Email: ${email}\n` +
        `Valor: R$ ${valorBR}\n` +
        `Data: ${dataBR}\n` +
        `👉 Liberar acesso manualmente`;

      const { data: config } = await supabase
        .from("whatsapp_config")
        .select("phone_number_id, access_token")
        .eq("user_id", SENDER_USER_ID)
        .eq("is_active", true)
        .maybeSingle();

      if (!config?.phone_number_id || !config?.access_token) {
        console.error("[comexia-webhook] whatsapp_config indisponível — notificação não enviada");
      } else {
        const waResp = await fetch(
          `https://graph.facebook.com/v25.0/${config.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: DESTINO_NOTIFICACAO,
              type: "text",
              text: { body: mensagem },
            }),
          },
        );
        const waData = await waResp.json();
        if (!waResp.ok) {
          console.error("[comexia-webhook] Erro WhatsApp:", JSON.stringify(waData));
        } else {
          console.log("✅ [comexia-webhook] Notificação enviada para", DESTINO_NOTIFICACAO);
          if (registroId) {
            await supabase
              .from("comexia_pagamentos")
              .update({ notificado: true })
              .eq("id", registroId);
          }
        }
      }
    } catch (notifErr) {
      console.error("[comexia-webhook] Falha na notificação (não-crítico):", notifErr);
    }
  } catch (e) {
    console.error("[comexia-webhook] FATAL", e);
  }

  return ok();
});
