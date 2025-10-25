import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    if (!keyword || keyword.trim() === '') {
      throw new Error('A palavra-chave de busca é obrigatória.');
    }
    
    console.log(`[SHOPEE SMART SEARCH] Iniciando busca por: "${keyword}"`);
    
    // USAR A API PÚBLICA DA SHOPEE PARA BUSCAR OS MAIS VENDIDOS
    const shopeePublicUrl = 'https://shopee.com.br/api/v4/search/search_items';
    const params = new URLSearchParams({
      by: 'sales', // Ordenar por mais vendidos
      keyword: keyword,
      limit: Math.min(limit, 60).toString(),
      newest: '0',
      order: 'desc',
      page_type: 'search',
      scenario: 'PAGE_GLOBAL_SEARCH',
      version: '2',
    });
    
    // Headers para imitar navegador e evitar bloqueio 403
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://shopee.com.br/',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://shopee.com.br',
    };
    
    const response = await fetch(`${shopeePublicUrl}?${params}`, {
      headers: requestHeaders,
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao comunicar com a API da Shopee. Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Erro retornado pela API da Shopee: ${data.error_msg || data.error}`);
    }
    
    console.log(`[SHOPEE SMART SEARCH] Produtos brutos encontrados: ${data.items?.length || 0}`);
    
    // MAPEAR E FORMATAR OS DADOS PARA O NOSSO PADRÃO
    const products = (data.items || []).map((item: any) => {
      const productLink = `https://shopee.com.br/product/${item.shopid}/${item.itemid}`;

      return {
        id: `shopee_${item.itemid}`,
        title: item.name,
        price: (item.price || 0) / 100000,
        priceFrom: item.price_max ? item.price_max / 100000 : null,
        imageUrl: `https://cf.shopee.com.br/file/${item.images?.[0] || ''}`,
        affiliateLink: productLink,
        
        // DADOS DE PERFORMANCE
        sales: item.sold || 0,
        historicalSold: item.historical_sold || 0,
        rating: item.item_rating?.rating_star || 0,
        reviews: item.item_rating?.rating_count?.[0] || 0,
        discount: item.raw_discount || 0,
        
        // Campos compatíveis com ProductCard
        commission: 0, // Será calculado posteriormente
        commissionPercent: 0,
        category: 'Shopee',
        marketplace: 'shopee',
        badge: item.sold > 1000 ? 'Best Seller' : '',
      };
    });
    
    return new Response(
      JSON.stringify({ products: products }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
    
  } catch (error: any) {
    console.error('[SHOPEE SMART SEARCH] Erro na Edge Function:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, products: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
