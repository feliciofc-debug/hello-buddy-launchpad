// Edge Function: comexia-checkout-link
// Gera um link de pagamento PÚBLICO e REUTILIZÁVEL de R$ 1.997,00 (produto "comexia").
// NÃO toca em nada do billing dos clientes AMZ.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALOR_COMEXIA = 1997.0;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const appUrl = "https://comexia.app";

    const preference = {
      items: [
        {
          id: "comexia-plataforma",
          title: "comexia — Plataforma de Cotação de Importação",
          description: "Acesso à plataforma comexia de cotação de importação",
          quantity: 1,
          unit_price: VALOR_COMEXIA,
          currency_id: "BRL",
        },
      ],
      external_reference: "comexia",
      metadata: { produto: "comexia" },
      notification_url: `${supabaseUrl}/functions/v1/comexia-webhook`,
      back_urls: {
        success: `${appUrl}/?pagamento=sucesso`,
        failure: `${appUrl}/?pagamento=falha`,
        pending: `${appUrl}/?pagamento=pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "COMEXIA",
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12,
      },
    };

    const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("[comexia-checkout-link] MP error:", mpData);
      return json({ success: false, error: "Mercado Pago retornou erro", mp: mpData });
    }

    return json({
      success: true,
      payment_link: mpData.init_point || mpData.sandbox_init_point,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      preference_id: mpData.id,
      amount: VALOR_COMEXIA,
      produto: "comexia",
    });
  } catch (e) {
    console.error("[comexia-checkout-link] FATAL", e);
    return json({ success: false, error: (e as Error).message });
  }
});
