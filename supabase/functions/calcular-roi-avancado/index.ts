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
    const { 
      productPrice, 
      commission, 
      adSpend, 
      estimatedSales = 10,
      clicks = 100,
      conversions = 5
    } = await req.json();

    console.log('Calculando ROI avançado:', { 
      productPrice, 
      commission, 
      adSpend, 
      estimatedSales 
    });

    // Validações
    if (!commission || commission <= 0) {
      throw new Error('Comissão deve ser maior que zero');
    }

    // Cálculos de ROI
    const totalRevenue = commission * estimatedSales;
    const profit = totalRevenue - adSpend;
    const roi = adSpend > 0 ? ((profit / adSpend) * 100) : 0;
    const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;
    const breakEvenSales = commission > 0 ? Math.ceil(adSpend / commission) : 0;
    const projectedProfit = (estimatedSales * commission) - adSpend;

    // Métricas de performance
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const costPerClick = clicks > 0 ? adSpend / clicks : 0;
    const costPerAcquisition = conversions > 0 ? adSpend / conversions : 0;
    const revenuePerClick = clicks > 0 ? (commission * conversions) / clicks : 0;
    const averageOrderValue = productPrice;

    // Análise de viabilidade
    let viabilidade = 'baixa';
    if (roi > 100) viabilidade = 'alta';
    else if (roi > 50) viabilidade = 'média';

    // Recomendações baseadas em ROI
    const recomendacoes = [];
    
    if (roi < 0) {
      recomendacoes.push('⚠️ ROI negativo: Revise sua estratégia de anúncios');
      recomendacoes.push('💡 Considere otimizar suas campanhas ou escolher produtos com maior comissão');
    } else if (roi < 50) {
      recomendacoes.push('📊 ROI baixo: Há espaço para melhorias');
      recomendacoes.push('🎯 Teste diferentes públicos-alvo');
    } else if (roi < 100) {
      recomendacoes.push('✅ ROI moderado: Continue otimizando');
      recomendacoes.push('📈 Escale gradualmente os investimentos');
    } else {
      recomendacoes.push('🚀 Excelente ROI! Este produto é altamente lucrativo');
      recomendacoes.push('💰 Considere aumentar o investimento em anúncios');
    }

    if (conversionRate < 2) {
      recomendacoes.push('🔍 Taxa de conversão baixa: Melhore sua página de destino');
    }

    if (costPerAcquisition > commission) {
      recomendacoes.push('⚡ CPA muito alto: Você está gastando mais que ganha por venda');
    }

    const resultado = {
      // ROI Básico
      totalRevenue: Number(totalRevenue.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      margin: Number(margin.toFixed(2)),
      breakEvenSales,
      projectedProfit: Number(projectedProfit.toFixed(2)),

      // Métricas de Performance
      performance: {
        conversionRate: Number(conversionRate.toFixed(2)),
        costPerClick: Number(costPerClick.toFixed(2)),
        costPerAcquisition: Number(costPerAcquisition.toFixed(2)),
        revenuePerClick: Number(revenuePerClick.toFixed(2)),
        averageOrderValue: Number(averageOrderValue.toFixed(2))
      },

      // Análise
      analise: {
        viabilidade,
        recomendacoes
      },

      // Projeções
      projecoes: {
        vendas30Dias: estimatedSales * 30,
        receita30Dias: Number((totalRevenue * 30).toFixed(2)),
        lucro30Dias: Number((profit * 30).toFixed(2)),
        investimentoNecessario: Number((adSpend * 30).toFixed(2))
      }
    };

    console.log('ROI calculado com sucesso:', resultado);

    return new Response(
      JSON.stringify(resultado),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro ao calcular ROI:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Erro ao calcular ROI'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
