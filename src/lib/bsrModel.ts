// src/lib/bsrModel.ts

/**
 * @file Contém a lógica de negócio para estimar vendas diárias com base no BSR da Amazon.
 * @author Felicio Frauches Carega (com assistência de Manus)
 */

// Interface para definir a estrutura dos parâmetros do modelo
interface SalesModelParams {
  a: number;
  b: number;
}

/**
 * Modelo de dados com as constantes de regressão logarítmica para cada categoria.
 * A fórmula utilizada é: Vendas = a * ln(BSR) + b
 * Estas são constantes iniciais baseadas em estimativas de mercado.
 * Elas podem e devem ser refinadas com o tempo para maior precisão.
 */
const bsrSalesModel: Record<string, SalesModelParams> = {
  // Categoria: { constante 'a', constante 'b' }
  "Books": { a: -350, b: 5000 },
  "Home & Kitchen": { a: -150, b: 2500 },
  "Electronics": { a: -120, b: 2000 },
  "Health & Household": { a: -180, b: 3000 },
  "Toys & Games": { a: -100, b: 1500 },
  "Sports & Outdoors": { a: -110, b: 1800 },
  "Clothing, Shoes & Jewelry": { a: -200, b: 3500 },
  
  // Modelo padrão para qualquer categoria não listada acima
  "default": { a: -50, b: 800 }
};

/**
 * Estima o número de vendas diárias de um produto com base em seu BSR e categoria.
 * 
 * @param bsr O Best Sellers Rank (BSR) do produto. Deve ser um número maior que 0.
 * @param category A categoria principal do produto (ex: "Home & Kitchen").
 * @returns Um número inteiro representando a estimativa de vendas diárias.
 */
export function estimateDailySales(bsr: number, category: string): number {
  // Garante que o BSR seja no mínimo 1 para evitar erros matemáticos com Math.log()
  if (bsr <= 0) {
    return 0;
  }

  // Encontra os parâmetros do modelo para a categoria fornecida.
  // Se a categoria não for encontrada, usa o modelo 'default'.
  const modelParams = bsrSalesModel[category] || bsrSalesModel.default;

  // Extrai as constantes 'a' and 'b'
  const { a, b } = modelParams;

  // Calcula a estimativa usando a fórmula de regressão logarítmica
  const estimatedSales = a * Math.log(bsr) + b;

  // A estimativa nunca pode ser negativa. Se for, retornamos 0.
  // Usamos Math.round() para retornar um número inteiro de vendas.
  const finalEstimation = Math.round(Math.max(0, estimatedSales));

  return finalEstimation;
}
