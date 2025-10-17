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
    
    console.log('Criando pagamento temporário:', { plano, valor, nome });
    
    // Simulação de pagamento PIX temporário
    const pixCode = `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${valor.toFixed(2)}5802BR5913AMZ Ofertas6009SAO PAULO62070503***6304XXXX`;
    
    // Retorna dados simulados para teste
    return new Response(
      JSON.stringify({
        success: true,
        payment_type: 'pix',
        pix_code: pixCode,
        amount: valor,
        status: 'pending',
        message: 'Pagamento de teste gerado com sucesso'
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
