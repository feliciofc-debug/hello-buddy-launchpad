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
    const body = await req.json();
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se é notificação de pagamento
    if (body.type === 'payment' && body.data?.id) {
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      
      // Buscar detalhes do pagamento no Mercado Pago
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${body.data.id}`,
        {
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`
          }
        }
      );

      if (!response.ok) {
        console.error('Erro ao buscar pagamento:', await response.text());
        return new Response(
          JSON.stringify({ received: true, error: 'Erro ao buscar pagamento' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payment = await response.json();
      console.log('Detalhes do pagamento:', JSON.stringify(payment, null, 2));

      // Se pagamento aprovado
      if (payment.status === 'approved') {
        const email = payment.payer?.email;
        const planName = payment.metadata?.plan_name || 'Pro';
        const planType = payment.metadata?.plan_type || 'monthly';
        let userId = payment.metadata?.user_id || payment.external_reference;

        console.log('Pagamento aprovado para:', email);

        // Se não tem userId, buscar por email
        if (!userId && email) {
          const { data: authUser } = await supabase.auth.admin.listUsers();
          const user = authUser?.users?.find(u => u.email === email);
          if (user) {
            userId = user.id;
          }
        }

        if (userId) {
          // Calcular data de expiração
          const expirationDate = new Date();
          if (planType === 'monthly') {
            expirationDate.setMonth(expirationDate.getMonth() + 1);
          } else {
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);
          }

          // Criar ou atualizar assinatura
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              plan_id: planName,
              status: 'active',
              amount: payment.transaction_amount,
              payment_id: payment.id.toString(),
              payment_method: 'mercadopago',
              expires_at: expirationDate.toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });

          if (subscriptionError) {
            console.error('Erro ao criar/atualizar assinatura:', subscriptionError);
          } else {
            console.log('✅ Assinatura ativada automaticamente via webhook para:', email);
          }
        } else {
          console.warn('UserId não encontrado para o pagamento');
        }
      } else {
        console.log('Pagamento não aprovado. Status:', payment.status);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ 
        received: true,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
