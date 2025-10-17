import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    // Criar preferência de pagamento no Mercado Pago
    const preference = {
      items: [
        {
          title: `${nome}`,
          unit_price: valor,
          quantity: 1,
        }
      ],
      payment_methods: {
        installments: 12,
      },
      back_urls: {
        success: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        failure: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        pending: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`
      },
      auto_return: 'approved',
      external_reference: plano,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
      statement_descriptor: 'AMZ OFERTAS',
    };

    console.log('Criando preferência no Mercado Pago:', preference);

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();
    
    console.log('Resposta do Mercado Pago:', data);

    if (!data.init_point) {
      throw new Error('Erro ao criar preferência de pagamento');
    }

    return new Response(
      JSON.stringify({
        init_point: data.init_point,
        preference_id: data.id
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
