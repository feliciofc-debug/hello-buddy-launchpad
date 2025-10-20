// supabase/functions/estimate-sales/index.ts

/**
 * @file Edge Function para calcular estimativa de vendas baseada no BSR da Amazon
 * @author Felicio Frauches Carega
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface para definir a estrutura dos parâmetros do modelo
interface SalesModelParams {
  a: number;
  b: number;
}

/**
 * Modelo de dados com as constantes de regressão logarítmica para cada categoria.
 * A fórmula utilizada é: Vendas = a * ln(BSR) + b
 */
const bsrSalesModel: Record<string, SalesModelParams> = {
  "Books": { a: -350, b: 5000 },
  "Home & Kitchen": { a: -150, b: 2500 },
  "Electronics": { a: -120, b: 2000 },
  "Health & Household": { a: -180, b: 3000 },
  "Toys & Games": { a: -100, b: 1500 },
  "Sports & Outdoors": { a: -110, b: 1800 },
  "Clothing, Shoes & Jewelry": { a: -200, b: 3500 },
  "default": { a: -50, b: 800 }
};

/**
 * Estima o número de vendas diárias de um produto com base em seu BSR e categoria.
 */
function estimateDailySales(bsr: number, category: string): number {
  if (bsr <= 0) {
    return 0;
  }

  const modelParams = bsrSalesModel[category] || bsrSalesModel.default;
  const { a, b } = modelParams;
  const estimatedSales = a * Math.log(bsr) + b;
  const finalEstimation = Math.round(Math.max(0, estimatedSales));

  return finalEstimation;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("✅ [API] Rota estimate-sales foi chamada!");
    
    // Aceita tanto query params quanto body
    let bsr: number;
    let category: string;
    
    if (req.method === 'POST') {
      const body = await req.json();
      bsr = body.bsr;
      category = body.category;
      console.log(`[API] Parâmetros recebidos via POST body: bsr=${bsr}, category=${category}`);
    } else {
      const url = new URL(req.url);
      const bsrParam = url.searchParams.get('bsr');
      const categoryParam = url.searchParams.get('category');
      bsr = bsrParam ? parseInt(bsrParam, 10) : 0;
      category = categoryParam || '';
      console.log(`[API] Parâmetros recebidos via query: bsr=${bsr}, category=${category}`);
    }

    // Validação dos parâmetros de entrada
    if (!bsr || !category) {
      console.error("[API] Erro: Parâmetros faltando");
      return new Response(
        JSON.stringify({ 
          error: 'Parâmetros "bsr" e "category" são obrigatórios.' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (typeof bsr !== 'number' || isNaN(bsr) || bsr <= 0) {
      console.error("[API] Erro: BSR inválido");
      return new Response(
        JSON.stringify({ 
          error: 'O parâmetro "bsr" deve ser um número positivo.' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Chama a função de estimativa
    const estimatedSales = estimateDailySales(bsr, category);

    console.log(`[API] BSR: ${bsr}, Categoria: ${category}, Vendas estimadas: ${estimatedSales}`);

    // Retorna a resposta com sucesso
    return new Response(
      JSON.stringify({ 
        bsr,
        category: category,
        estimatedDailySales: estimatedSales 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Erro na API de estimativa de vendas:", error);
    return new Response(
      JSON.stringify({ 
        error: 'Ocorreu um erro interno no servidor.' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
