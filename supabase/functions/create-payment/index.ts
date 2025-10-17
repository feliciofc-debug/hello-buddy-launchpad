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
    const { userId, userEmail, planType } = await req.json();
    
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    console.log('Criando pagamento para:', { userId, userEmail, planType });

    // Criar preferência de pagamento no Mercado Pago
    // NÃO excluir métodos de pagamento para permitir PIX, Cartão e Boleto
    const preference = {
      items: [
        {
          title: 'AMZ Ofertas - Plano Mensal',
          description: 'Acesso completo à plataforma',
          unit_price: 147.00,
          quantity: 1,
          currency_id: 'BRL'
        }
      ],
      payer: {
        email: userEmail,
        name: 'Cliente AMZ Ofertas'
      },
      payment_methods: {
        installments: 12,
        // Não excluir nenhum tipo de pagamento para permitir PIX
        excluded_payment_types: [],
        excluded_payment_methods: []
      },
      back_urls: {
        success: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/dashboard`,
        failure: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/planos`,
        pending: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/planos`
      },
      auto_return: 'approved',
      external_reference: userId,
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
        success: true,
        checkoutUrl: data.init_point,
        preferenceId: data.id
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
