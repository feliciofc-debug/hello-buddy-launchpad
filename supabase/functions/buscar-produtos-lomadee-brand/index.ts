import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appToken, brandSlug, page = 1, limit = 20 } = await req.json();

    if (!appToken) {
      throw new Error('APP_TOKEN da Lomadee é obrigatório');
    }

    if (!brandSlug) {
      throw new Error('brandSlug é obrigatório');
    }

    console.log(`[LOMADEE-PRODUCTS] Buscando produtos da loja: ${brandSlug}`);

    // Chamar API da Lomadee para buscar produtos de uma brand específica
    const lomadeeUrl = `https://api-beta.lomadee.com.br/affiliate/brands/${brandSlug}/products?page=${page}&limit=${limit}`;
    
    console.log('[LOMADEE-PRODUCTS] URL:', lomadeeUrl);

    const response = await fetch(lomadeeUrl, {
      method: 'GET',
      headers: {
        'x-api-key': appToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LOMADEE-PRODUCTS] Erro na API:', response.status, errorText);
      throw new Error(`Erro ao buscar produtos: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[LOMADEE-PRODUCTS] Resposta recebida - produtos encontrados`);

    // Extrair produtos
    const products: any[] = [];
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((product: any) => {
        if (product.name && product.price) {
          products.push({
            id: product.id || product.sku,
            name: product.name,
            price: product.price.value || product.price,
            originalPrice: product.price.originalValue || null,
            image: product.images?.[0] || product.image || null,
            url: product.url || product.link,
            category: product.category?.name || 'Sem categoria',
            commission: product.commission?.value || 10
          });
        }
      });
    }
    
    console.log(`[LOMADEE-PRODUCTS] Total de produtos processados: ${products.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        products,
        total: data.meta?.total || products.length,
        page: data.meta?.page || page,
        totalPages: data.meta?.totalPages || 1
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('[LOMADEE-PRODUCTS] Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar produtos'
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
