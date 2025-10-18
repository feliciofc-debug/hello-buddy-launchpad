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
    console.log('Criando boleto:', body);

    const mercadopagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!mercadopagoToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    // Criar pagamento com boleto
    const payment = {
      ...body,
      payment_method_id: 'bolbradesco',
      date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 dias
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadopagoToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}`
      },
      body: JSON.stringify(payment)
    });

    const data = await response.json();
    console.log('Resposta Mercado Pago:', data);

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data);
      
      let errorMessage = 'Erro ao criar boleto';
      if (data.cause?.[0]?.description) {
        errorMessage = data.cause[0].description;
      } else if (data.message) {
        errorMessage = data.message;
      }
      
      return new Response(
        JSON.stringify({ error: true, message: errorMessage }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        barcode: data.barcode?.content,
        pdf_url: data.transaction_details?.external_resource_url,
        due_date: data.date_of_expiration
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao criar boleto:', error);
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
