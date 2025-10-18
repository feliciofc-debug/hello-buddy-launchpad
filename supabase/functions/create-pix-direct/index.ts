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
    console.log('Criando PIX direto:', body);

    const mercadopagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!mercadopagoToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    // Fazer requisição direta para API do Mercado Pago
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadopagoToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}` // Evita duplicação
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('Resposta Mercado Pago:', data);

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data);
      
      // Tratar erros específicos
      let errorMessage = 'Erro ao processar pagamento';
      
      if (data.cause) {
        if (data.cause[0]?.code === '2067') {
          errorMessage = 'CPF inválido. Verifique o número digitado.';
        } else if (data.cause[0]?.code === '106') {
          errorMessage = 'Email inválido. Verifique o email digitado.';
        } else if (data.cause[0]?.description) {
          errorMessage = data.cause[0].description;
        }
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

    // Retornar dados do PIX
    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: data.point_of_interaction?.transaction_data?.ticket_url,
        expiration_date: data.date_of_expiration
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Erro ao criar PIX:', error);
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
