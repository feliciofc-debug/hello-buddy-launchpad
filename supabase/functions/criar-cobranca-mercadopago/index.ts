// Edge Function: criar-cobranca-mercadopago
// Cria uma Mercado Pago Preference para um billing_customer e retorna o init_point.
// Vincula via external_reference = billing_subscription.id (para reconciliar no webhook).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-billing-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyBillingToken(token: string): Promise<boolean> {
  const adminPassword = Deno.env.get("BILLING_ADMIN_PASSWORD");
  if (!adminPassword) return false;
  const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const days = [currentDay, currentDay - 1, currentDay + 1];
  const hashes = await Promise.all(
    days.map((d) => sha256Hex(`${adminPassword}:${d}`)),
  );
  if (hashes.includes(token)) return true;
  if (token === adminPassword) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const billingToken = req.headers.get("x-billing-token") || "";
    if (!billingToken || !(await verifyBillingToken(billingToken))) {
      return json({ success: false, error: "invalid billing token" }, 401);
    }

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) return json({ success: false, error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const customerId: string | undefined = body?.customer_id;
    if (!customerId) return json({ success: false, error: "customer_id obrigatório" }, 400);

    const { data: cli } = await supabase
      .from("billing_customers")
      .select("id, name, email, phone")
      .eq("id", customerId)
      .maybeSingle();
    if (!cli) return json({ success: false, error: "customer não encontrado" }, 404);

    const { data: sub } = await supabase
      .from("billing_subscriptions")
      .select("id, amount, next_billing_date, dia_vencimento")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return json({ success: false, error: "subscription não encontrada" }, 404);

    const valor = Number(sub.amount ?? 597);
    const venc = sub.next_billing_date
      ? String(sub.next_billing_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const ref = `${venc.replaceAll("-", "")}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const appUrl = Deno.env.get("APP_URL") || "https://amzofertas.com.br";

    const preference = {
      items: [
        {
          id: `mensalidade-${sub.id}`,
          title: `Mensalidade AMZ Ofertas Pro - venc. ${venc}`,
          description: `Assinatura mensal ${cli.name || cli.email}`,
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: cli.email || undefined,
        name: cli.name || undefined,
      },
      external_reference: sub.id,
      metadata: {
        subscription_id: sub.id,
        customer_id: customerId,
        ref,
      },
      notification_url: `${supabaseUrl}/functions/v1/billing-webhook`,
      back_urls: {
        success: `${appUrl}/?pago=sucesso`,
        failure: `${appUrl}/?pago=falha`,
        pending: `${appUrl}/?pago=pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "AMZ OFERTAS",
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12,
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
      return json({ success: false, error: "Mercado Pago retornou erro", mp: mpData }, 200);
    }

    const initPoint: string = mpData.init_point || mpData.sandbox_init_point;
    const prefId: string = mpData.id;

    // Salvar link em billing_customers.payment_link (campo já existe)
    await supabase
      .from("billing_customers")
      .update({ payment_link: initPoint })
      .eq("id", customerId);

    return json({
      success: true,
      payment_link: initPoint,
      preference_id: prefId,
      subscription_id: sub.id,
      amount: valor,
      vencimento: venc,
    });
  } catch (e) {
    console.error("[criar-cobranca-mercadopago] FATAL", e);
    return json({ success: false, error: (e as Error).message }, 200);
  }
});
