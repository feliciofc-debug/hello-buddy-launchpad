// Edge Function: criar-cobranca-onboarding
// Cria billing_customer + billing_subscription pending para novo cliente logo após signup
// Retorna subscription_id para redirect ao /pagar/:id (mesmo fluxo já validado)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHLY_AMOUNT = 597;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const { user_id, email, whatsapp, nome } = body || {};

    if (!user_id || !email) {
      return json({ success: false, error: "user_id e email são obrigatórios" }, 400);
    }

    // 1) Verificar se já existe subscription para esse user (idempotência)
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("platform_login", user_id)
      .maybeSingle();

    let customerId: string | null = existingCustomer?.id ?? null;

    if (!customerId) {
      const { data: newCustomer, error: cErr } = await supabase
        .from("billing_customers")
        .insert({
          name: nome || String(email).split("@")[0] || "Cliente",
          email: String(email).trim().toLowerCase(),
          phone: whatsapp || null,
          platform_login: user_id,
          tipo_pessoa: "pf",
        })
        .select("id")
        .single();

      if (cErr) {
        console.error("Erro criar customer:", cErr);
        return json({ success: false, error: cErr.message }, 500);
      }
      customerId = newCustomer.id;
    }

    // 2) Verificar subscription existente
    const { data: existingSub } = await supabase
      .from("billing_subscriptions")
      .select("id, status")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existingSub?.id) {
      return json({
        success: true,
        subscription_id: existingSub.id,
        customer_id: customerId,
        reused: true,
      });
    }

    const today = new Date();
    const diaVencimento = today.getDate();
    const periodStart = today.toISOString().slice(0, 10);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
      .toISOString().slice(0, 10);

    const { data: newSub, error: sErr } = await supabase
      .from("billing_subscriptions")
      .insert({
        customer_id: customerId,
        status: "pending_payment",
        amount: MONTHLY_AMOUNT,
        dia_vencimento: diaVencimento,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        next_billing_date: periodEnd,
      })
      .select("id")
      .single();

    if (sErr) {
      console.error("Erro criar subscription:", sErr);
      return json({ success: false, error: sErr.message }, 500);
    }

    return json({
      success: true,
      subscription_id: newSub.id,
      customer_id: customerId,
      reused: false,
    });
  } catch (e) {
    console.error("[criar-cobranca-onboarding] FATAL", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
