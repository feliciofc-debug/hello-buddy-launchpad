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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter usuário autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          hasActiveSubscription: false,
          message: 'Usuário não autenticado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          hasActiveSubscription: false,
          message: 'Erro ao obter usuário' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verificando assinatura para:', user.email);

    // Verificar assinatura no banco
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Erro ao buscar assinatura:', subError);
    }

    // Se tem assinatura ativa no banco
    if (subscription && subscription.status === 'active') {
      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();

      if (expiresAt > now) {
        console.log('✅ Assinatura ativa encontrada no banco');
        return new Response(
          JSON.stringify({ 
            hasActiveSubscription: true,
            plan: subscription.plan_id,
            expiresAt: subscription.expires_at,
            status: subscription.status,
            source: 'database'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se não encontrou no banco, verificar no Mercado Pago
    console.log('Verificando pagamentos no Mercado Pago...');
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (mpAccessToken && user.email) {
      try {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/search?payer.email=${encodeURIComponent(user.email)}&status=approved&sort=date_created&criteria=desc&limit=10`,
          {
            headers: {
              'Authorization': `Bearer ${mpAccessToken}`
            }
          }
        );

        if (mpResponse.ok) {
          const mpData = await mpResponse.json();
          
          if (mpData.results && mpData.results.length > 0) {
            // Pegar o pagamento mais recente
            const latestPayment = mpData.results[0];
            const paymentDate = new Date(latestPayment.date_approved);
            const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);

            // Se pagamento foi nos últimos 30 dias
            if (daysSincePayment <= 30) {
              console.log('✅ Pagamento ativo encontrado no Mercado Pago');
              
              // Criar/atualizar assinatura no banco
              const expirationDate = new Date(paymentDate);
              expirationDate.setMonth(expirationDate.getMonth() + 1);

              const { error: upsertError } = await supabase
                .from('subscriptions')
                .upsert({
                  user_id: user.id,
                  plan_id: latestPayment.metadata?.plan_name || 'Pro',
                  status: 'active',
                  amount: latestPayment.transaction_amount,
                  payment_id: latestPayment.id.toString(),
                  payment_method: 'mercadopago',
                  expires_at: expirationDate.toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id'
                });

              if (upsertError) {
                console.error('Erro ao sincronizar assinatura:', upsertError);
              } else {
                console.log('Assinatura sincronizada do Mercado Pago');
              }

              return new Response(
                JSON.stringify({ 
                  hasActiveSubscription: true,
                  plan: latestPayment.metadata?.plan_name || 'Pro',
                  expiresAt: expirationDate.toISOString(),
                  status: 'active',
                  source: 'mercadopago',
                  paymentId: latestPayment.id
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
      } catch (mpError) {
        console.error('Erro ao verificar Mercado Pago:', mpError);
      }
    }

    // Nenhuma assinatura ativa encontrada
    console.log('❌ Nenhuma assinatura ativa encontrada');
    return new Response(
      JSON.stringify({ 
        hasActiveSubscription: false,
        message: 'Nenhuma assinatura ativa encontrada',
        source: 'none'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao verificar assinatura:', error);
    return new Response(
      JSON.stringify({ 
        hasActiveSubscription: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
