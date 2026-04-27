import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, payment_id, plan_name, plan_type, amount } = await req.json();
    console.log('Ativando assinatura:', { user_id, payment_id, plan_name, plan_type, amount });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calcular data de expiração
    const expirationDate = new Date();
    if (plan_type === 'monthly') {
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    } else {
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }

    // 1) Subscriptions (legacy/tabela de acesso à plataforma)
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id,
        plan_id: plan_name,
        status: 'active',
        amount,
        payment_id,
        payment_method: 'mercadopago',
        expires_at: expirationDate.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (subscriptionError) {
      console.error('Erro ao criar subscription:', subscriptionError);
      throw subscriptionError;
    }

    // 2) Billing → garantir que aparece em /pay/admin como cliente recorrente
    try {
      // Buscar perfil para nome / cpf / email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nome, email, whatsapp, cpf')
        .eq('id', user_id)
        .maybeSingle();

      // Buscar email do auth se não tiver no profile
      let userEmail = profile?.email as string | undefined;
      if (!userEmail) {
        const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
        userEmail = authUser?.user?.email || `user-${user_id}@amzofertas.com`;
      }
      const userName = profile?.nome || userEmail.split('@')[0] || 'Cliente';

      // Upsert customer (chave: platform_login = user_id)
      let customerId: string | null = null;
      const { data: existingCustomer } = await supabase
        .from('billing_customers')
        .select('id')
        .eq('platform_login', user_id)
        .maybeSingle();

      if (existingCustomer?.id) {
        customerId = existingCustomer.id;
        await supabase
          .from('billing_customers')
          .update({
            name: userName,
            email: userEmail,
            phone: profile?.whatsapp || null,
            cpf: profile?.cpf || null,
          })
          .eq('id', customerId);
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from('billing_customers')
          .insert({
            name: userName,
            email: userEmail,
            phone: profile?.whatsapp || null,
            cpf: profile?.cpf || null,
            platform_login: user_id,
            tipo_pessoa: 'pf',
          })
          .select('id')
          .single();
        if (custErr) {
          console.error('Erro ao criar billing_customer:', custErr);
        } else {
          customerId = newCustomer.id;
        }
      }

      if (customerId) {
        const today = new Date();
        const diaVencimento = today.getDate();
        const periodStart = today.toISOString().slice(0, 10);
        const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
          .toISOString().slice(0, 10);

        // Upsert billing_subscription para esse customer
        const { data: existingBSub } = await supabase
          .from('billing_subscriptions')
          .select('id')
          .eq('customer_id', customerId)
          .maybeSingle();

        let billingSubId: string | null = existingBSub?.id || null;

        if (billingSubId) {
          await supabase
            .from('billing_subscriptions')
            .update({
              status: 'active',
              amount,
              dia_vencimento: diaVencimento,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              next_billing_date: periodEnd,
              last_payment_date: new Date().toISOString(),
              payment_fail_count: 0,
            })
            .eq('id', billingSubId);
        } else {
          const { data: newBSub, error: bsubErr } = await supabase
            .from('billing_subscriptions')
            .insert({
              customer_id: customerId,
              status: 'active',
              amount,
              dia_vencimento: diaVencimento,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              next_billing_date: periodEnd,
              last_payment_date: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (bsubErr) {
            console.error('Erro ao criar billing_subscription:', bsubErr);
          } else {
            billingSubId = newBSub.id;
          }
        }

        // Registrar transação (paga)
        if (billingSubId) {
          const { error: txErr } = await supabase
            .from('billing_transactions')
            .insert({
              subscription_id: billingSubId,
              customer_id: customerId,
              mp_payment_id: String(payment_id),
              amount,
              status: 'approved',
              payment_date: new Date().toISOString(),
              webhook_received: true,
              raw: { source: 'activate-subscription', plan_name, plan_type },
            });
          if (txErr) console.error('Erro ao criar billing_transaction:', txErr);
        }
      }
    } catch (billingErr) {
      // Nunca derrubar a ativação por causa do billing
      console.error('Erro no bloco billing (não-crítico):', billingErr);
    }

    console.log('Assinatura ativada com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura ativada com sucesso',
        expires_at: expirationDate.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro ao ativar assinatura:', error);
    return new Response(
      JSON.stringify({
        error: true,
        message: 'Erro ao ativar assinatura',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
