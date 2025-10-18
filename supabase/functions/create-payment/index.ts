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

    // Definir valores baseados no plano
    let price = 0;
    let title = '';
    let description = '';
    
    if (planType === 'teste') {
      price = 12.00; // R$12 total (R$1/mês x 12)
      title = 'AMZ Ofertas - Plano TESTE';
      description = 'Plano de teste - Funcionalidade completa por R$1/mês';
    } else if (planType === 'completo') {
      price = 1764.00; // R$1764 total (R$147/mês x 12)
      title = 'AMZ Ofertas - Plano Completo Anual';
      description = 'Acesso completo à plataforma - Pagamento anual parcelado';
    } else {
      throw new Error('Tipo de plano inválido');
    }

    // Criar preferência de pagamento no Mercado Pago
    // Permite PIX, Cartão e Boleto
    const preference = {
      items: [
        {
          title,
          description,
          unit_price: price,
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
      metadata: {
        plan_type: planType,
        user_id: userId
      }
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
