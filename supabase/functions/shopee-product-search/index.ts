import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Proxy para contornar bloqueio 403 da Shopee
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

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
    
    console.log(`[SHOPEE REVERSE ENG V4] Iniciando busca por: "${keyword}"`);
    
    // Construir URL da API da Shopee com parâmetros completos (engenharia reversa)
    const shopeePublicUrl = 'https://shopee.com.br/api/v4/search/search_items';
    const params = new URLSearchParams({
      by: 'sales',
      keyword: keyword,
      limit: Math.min(limit, 60).toString(),
      newest: '0',
      order: 'desc',
      page_type: 'search',
      scenario: 'PAGE_GLOBAL_SEARCH',
      version: '2',
      // Parâmetros adicionais descobertos por engenharia reversa
      entry_point: 'GlobalSearchPageSearchBar',
      __classic__: '1',
    });
    
    // Montar URL completa que será passada para o proxy
    const targetUrl = `${shopeePublicUrl}?${params}`;
    const proxyRequest = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
    
    console.log(`[SHOPEE REVERSE ENG V4] Usando proxy para: ${targetUrl}`);
    
    // Fazer requisição através do proxy
    const response = await fetch(proxyRequest);
    
    if (!response.ok) {
      throw new Error(`Erro ao comunicar com proxy ou Shopee. Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Verificar erros internos da API Shopee
    if (data.error || data.error_msg) {
      const errorMsg = data.error_msg || data.error || 'Erro desconhecido da Shopee';
      console.error(`[SHOPEE REVERSE ENG V4] Erro da API: ${errorMsg}`);
      throw new Error(`Erro da API Shopee: ${errorMsg}`);
    }
    
    console.log(`[SHOPEE REVERSE ENG V4] Produtos encontrados: ${data.items?.length || 0}`);
    
    // Mapear produtos para formato padrão
    const products = (data.items || []).map((item: any) => ({
      id: `shopee_${item.itemid}`,
      title: item.name,
      price: (item.price || 0) / 100000,
      priceFrom: item.price_max ? item.price_max / 100000 : null,
      imageUrl: `https://cf.shopee.com.br/file/${item.images?.[0] || ''}`,
      affiliateLink: `https://shopee.com.br/product/${item.shopid}/${item.itemid}`,
      
      // Dados de performance
      sales: item.sold || 0,
      historicalSold: item.historical_sold || 0,
      rating: item.item_rating?.rating_star || 0,
      reviews: item.item_rating?.rating_count?.[0] || 0,
      discount: item.raw_discount || 0,
      
      // Compatibilidade com ProductCard
      commission: 0,
      commissionPercent: 0,
      category: 'Shopee',
      marketplace: 'shopee',
      badge: item.sold > 1000 ? 'Best Seller' : '',
    }));
    
    return new Response(
      JSON.stringify({ products: products }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
    
  } catch (error: any) {
    console.error('[SHOPEE REVERSE ENG V4] Erro:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, products: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
