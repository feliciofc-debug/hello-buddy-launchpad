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
    const { paymentId } = await req.json();
    console.log('Verificando status do pagamento:', paymentId);

    const mercadopagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    if (!mercadopagoToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    // Buscar status na API do Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mercadopagoToken}`
      }
    });

    const data = await response.json();
    console.log('Status do pagamento:', data.status);
    
    return new Response(
      JSON.stringify({
        status: data.status,
        status_detail: data.status_detail,
        amount: data.transaction_amount,
        approved: data.status === 'approved'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('Erro ao verificar status:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao verificar status',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
