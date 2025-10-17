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
          title: `Plano ${nome} - AMZ Ofertas`,
          unit_price: valor,
          quantity: 1,
        }
      ],
      back_urls: {
        success: 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/payment-webhook',
        failure: 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/payment-webhook',
        pending: 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/payment-webhook'
      },
      auto_return: 'approved',
      external_reference: plano,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

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
    console.error('Erro ao criar preferência:', error);
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
