import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    console.log('Ativando assinatura:', { user_id, payment_id, plan_name, plan_type });

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

    // Criar ou atualizar assinatura
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user_id,
        plan_id: plan_name,
        status: 'active',
        amount: amount,
        payment_id: payment_id,
        payment_method: 'mercadopago',
        expires_at: expirationDate.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) {
      console.error('Erro ao criar assinatura:', subscriptionError);
      throw subscriptionError;
    }

    console.log('Assinatura ativada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Assinatura ativada com sucesso',
        expires_at: expirationDate.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao ativar assinatura:', error);
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: 'Erro ao ativar assinatura',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
