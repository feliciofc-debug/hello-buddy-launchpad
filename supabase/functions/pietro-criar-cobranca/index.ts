// Edge Function: pietro-criar-cobranca
// Chamada pelo Pietro (IA) quando fecha venda no WhatsApp.
// Cria/atualiza billing_customer + cria billing_subscription pendente
// e retorna o link de checkout (modal idêntico ao do site amzofertas.com.br)
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

function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const nome: string = (body?.nome || "").toString().trim();
    const whatsapp: string = onlyDigits(body?.whatsapp);
    const emailIn: string = (body?.email || "").toString().trim().toLowerCase();
    const valor: number = Number(body?.valor ?? 597);

    if (!nome || (!whatsapp && !emailIn)) {
      return json(
        { success: false, error: "nome e (whatsapp ou email) são obrigatórios" },
        400,
      );
    }

    // Email-fallback estável a partir do whatsapp para satisfazer NOT NULL/UNIQUE
    const email = emailIn || `${whatsapp}@lead.amzofertas.com.br`;

    // 1) Tenta achar customer por email
    let { data: customer } = await supabase
      .from("billing_customers")
      .select("id, name, email, phone")
      .eq("email", email)
      .maybeSingle();

    // 2) Se não achou e tem whatsapp, tenta por phone
    if (!customer && whatsapp) {
      const { data: byPhone } = await supabase
        .from("billing_customers")
        .select("id, name, email, phone")
        .eq("phone", whatsapp)
        .maybeSingle();
      if (byPhone) customer = byPhone;
    }

    // 3) Cria se ainda não existe
    if (!customer) {
      const { data: created, error: createErr } = await supabase
        .from("billing_customers")
        .insert({
          name: nome,
          email,
          phone: whatsapp || null,
        })
        .select("id, name, email, phone")
        .single();

      if (createErr) {
        console.error("[pietro-criar-cobranca] erro criando customer", createErr);
        return json({ success: false, error: createErr.message });
      }
      customer = created;
    }

    // 4) Reaproveita subscription pendente do mesmo cliente (se existir)
    const { data: existing } = await supabase
      .from("billing_subscriptions")
      .select("id, status, amount")
      .eq("customer_id", customer!.id)
      .eq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId: string;

    if (existing) {
      subscriptionId = existing.id;
    } else {
      const today = new Date();
      const venc = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const { data: sub, error: subErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: customer!.id,
          amount: valor,
          status: "pending_payment",
          next_billing_date: venc,
          dia_vencimento: today.getDate(),
        })
        .select("id")
        .single();

      if (subErr) {
        console.error("[pietro-criar-cobranca] erro criando subscription", subErr);
        return json({ success: false, error: subErr.message });
      }
      subscriptionId = sub.id;
    }

    const appUrl = Deno.env.get("APP_URL") || "https://www.amzofertas.com.br";
    const paymentLink = `${appUrl}/pagar/${subscriptionId}`;

    return json({
      success: true,
      subscription_id: subscriptionId,
      customer_id: customer!.id,
      payment_link: paymentLink,
      amount: valor,
    });
  } catch (e) {
    console.error("[pietro-criar-cobranca] FATAL", e);
    return json({ success: false, error: (e as Error).message });
  }
});
