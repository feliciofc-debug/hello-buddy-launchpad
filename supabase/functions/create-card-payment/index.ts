import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const body = await req.json();
    console.log('Criando pagamento com cartão:', body);

    const mercadopagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!mercadopagoToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    // Criar preferência para checkout (permite cartão com parcelamento)
    const preference = {
      items: [{
        title: body.description,
        unit_price: body.transaction_amount,
        quantity: 1,
        currency_id: 'BRL'
      }],
      payer: body.payer,
      payment_methods: {
        excluded_payment_types: [],
        installments: body.installments || 12,
        default_installments: body.installments || 1
      },
      statement_descriptor: 'AMZ OFERTAS',
      back_urls: {
        success: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/dashboard?payment=success`,
        failure: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/planos`,
        pending: `${req.headers.get('origin') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'}/planos`
      },
      auto_return: 'approved',
      external_reference: body.metadata?.user_id,
      metadata: body.metadata
    };
    
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadopagoToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    console.log('Resposta Mercado Pago:', data);

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data);
      return new Response(
        JSON.stringify({ error: true, message: 'Erro ao processar cartão' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
        status: 'pending'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao criar pagamento com cartão:', error);
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
