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
    const { comissao, investimento, vendasEsperadas } = await req.json();

    console.log('Calculando ROI:', { comissao, investimento, vendasEsperadas });

    // Validação
    if (comissao <= 0 || investimento <= 0 || vendasEsperadas <= 0) {
      throw new Error('Todos os valores devem ser maiores que zero');
    }

    const lucroTotal = comissao * vendasEsperadas;
    const lucroLiquido = lucroTotal - investimento;
    const roi = ((lucroLiquido / investimento) * 100);
    const breakEven = Math.ceil(investimento / comissao);
    const rentavel = lucroLiquido > 0;

    const resultado = {
      lucroTotal: parseFloat(lucroTotal.toFixed(2)),
      lucroLiquido: parseFloat(lucroLiquido.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      breakEven,
      rentavel,
      detalhes: {
        comissaoPorVenda: parseFloat(comissao.toFixed(2)),
        investimentoTotal: parseFloat(investimento.toFixed(2)),
        vendasNecessarias: breakEven,
        vendasProjetadas: vendasEsperadas
      }
    };

    console.log('ROI calculado:', resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao calcular ROI:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
