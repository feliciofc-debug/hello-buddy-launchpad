// TODO: Integrar cálculo de ROI (Return on Investment)
// Este arquivo calcula o retorno sobre investimento para campanhas de afiliados

import type { Product } from '@/types/product';

interface ROICalculation {
  roi: number;          // ROI percentual
  profit: number;       // Lucro líquido
  margin: number;       // Margem de lucro percentual
  breakEvenSales: number; // Vendas necessárias para empatar
  projectedProfit: number; // Lucro projetado
}

/**
 * Calcula o ROI de um produto considerando gastos com anúncios
 * @param product - Produto para calcular ROI
 * @param adSpend - Valor gasto em anúncios (R$)
 * @param estimatedSales - Número de vendas estimadas
 * @returns Cálculo detalhado do ROI
 * 
 * TODO: Melhorias futuras:
 * - Integrar com dados reais de conversão
 * - Considerar custos adicionais (plataforma, impostos)
 * - Adicionar análise de tendência histórica
 * - Calcular LTV (Lifetime Value) do cliente
 */
export function calculateROI(
  product: Product,
  adSpend: number,
  estimatedSales: number = 10
): ROICalculation {
  // Receita total da comissão
  const totalRevenue = product.commission * estimatedSales;
  
  // Lucro líquido (receita - gastos)
  const profit = totalRevenue - adSpend;
  
  // ROI percentual
  const roi = adSpend > 0 ? ((profit / adSpend) * 100) : 0;
  
  // Margem de lucro
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;
  
  // Vendas necessárias para empatar (break-even)
  const breakEvenSales = product.commission > 0 ? Math.ceil(adSpend / product.commission) : 0;
  
  // Lucro projetado (assumindo taxa de conversão de 2%)
  const projectedProfit = (estimatedSales * product.commission) - adSpend;

  return {
    roi: Number(roi.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    margin: Number(margin.toFixed(2)),
    breakEvenSales,
    projectedProfit: Number(projectedProfit.toFixed(2))
  };
}

/**
 * Calcula métricas avançadas de performance
 * TODO: Implementar com dados reais de conversão
 */
export function calculatePerformanceMetrics(
  product: Product,
  clicks: number,
  conversions: number,
  adSpend: number
) {
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const costPerClick = clicks > 0 ? adSpend / clicks : 0;
  const costPerAcquisition = conversions > 0 ? adSpend / conversions : 0;
  const revenuePerClick = clicks > 0 ? (product.commission * conversions) / clicks : 0;

  return {
    conversionRate: Number(conversionRate.toFixed(2)),
    costPerClick: Number(costPerClick.toFixed(2)),
    costPerAcquisition: Number(costPerAcquisition.toFixed(2)),
    revenuePerClick: Number(revenuePerClick.toFixed(2))
  };
}
