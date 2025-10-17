import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plano, valor, nome } = await req.json();
    
    // Obter o usuário autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    console.log('Criando pagamento temporário para usuário:', user.id);
    
    // Criar assinatura ativa para teste
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        status: 'active',
        plan_id: plano,
        amount: valor,
        payment_method: 'pix',
        payment_id: `test_${Date.now()}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias
      })
      .select()
      .single();

    if (subError) {
      console.error('Erro ao criar assinatura:', subError);
      throw subError;
    }

    console.log('Assinatura criada:', subscription);
    
    // Simulação de pagamento PIX temporário
    const pixCode = `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${valor.toFixed(2)}5802BR5913AMZ Ofertas6009SAO PAULO62070503***6304XXXX`;
    
    // Retorna dados simulados para teste
    return new Response(
      JSON.stringify({
        success: true,
        payment_type: 'pix',
        pix_code: pixCode,
        amount: valor,
        status: 'active',
        subscription_id: subscription.id,
        message: 'Pagamento de teste gerado e assinatura ativada!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
