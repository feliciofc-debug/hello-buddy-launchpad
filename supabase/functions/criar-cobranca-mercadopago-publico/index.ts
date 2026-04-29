// Edge Function: criar-cobranca-mercadopago-publico
// Versão PÚBLICA (sem token) — chamada pelo cliente final na página /pagar/:id
// Recebe subscription_id, valida que existe, e gera Preference MP retornando init_point.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) return json({ success: false, error: "MERCADOPAGO_ACCESS_TOKEN ausente" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const subscriptionId: string | undefined = body?.subscription_id;
    if (!subscriptionId) return json({ success: false, error: "subscription_id obrigatório" }, 400);

    const { data: sub } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, amount, next_billing_date")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub) return json({ success: false, error: "subscription não encontrada" }, 404);

    const { data: cli } = await supabase
      .from("billing_customers")
      .select("id, name, email")
      .eq("id", sub.customer_id)
      .maybeSingle();

    const valor = Number(sub.amount ?? 597);
    const venc = sub.next_billing_date
      ? String(sub.next_billing_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const appUrl = Deno.env.get("APP_URL") || "https://amzofertas.com.br";

    const preference = {
      items: [
        {
          id: `mensalidade-${sub.id}`,
          title: `Mensalidade AMZ Ofertas Pro - venc. ${venc}`,
          description: `Assinatura mensal ${cli?.name || cli?.email || ""}`.trim(),
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: cli?.email || undefined,
        name: cli?.name || undefined,
      },
      external_reference: sub.id,
      metadata: {
        subscription_id: sub.id,
        customer_id: sub.customer_id,
      },
      notification_url: `${supabaseUrl}/functions/v1/billing-webhook`,
      back_urls: {
        success: `${appUrl}/pagar/${sub.id}?status=sucesso`,
        failure: `${appUrl}/pagar/${sub.id}?status=falha`,
        pending: `${appUrl}/pagar/${sub.id}?status=pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "AMZ OFERTAS",
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 1,
        default_installments: 1,
      },
    };

    const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP error:", mpData);
      return json({ success: false, error: "Mercado Pago retornou erro", mp: mpData });
    }

    const initPoint: string = mpData.init_point || mpData.sandbox_init_point;

    return json({
      success: true,
      payment_link: initPoint,
      preference_id: mpData.id,
      amount: valor,
      vencimento: venc,
    });
  } catch (e) {
    console.error("[criar-cobranca-mercadopago-publico] FATAL", e);
    return json({ success: false, error: (e as Error).message });
  }
});
