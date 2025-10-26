import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// --- CONFIGURAÇÃO DAS CHAVES ---
const SHOPEE_APP_ID = Deno.env.get("SHOPEE_APP_ID") || "";
const SHOPEE_SECRET_KEY = Deno.env.get("SHOPEE_SECRET_KEY") || "";
const SCRAPER_API_KEY = Deno.env.get("SCRAPER_API_KEY") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- FUNÇÃO 1: COLETOR (BLINDADA COM PROXY) ---
async function coletarProdutosPublicos(keyword: string, limit = 50) {
  console.log(`[V7] Coletando produtos para "${keyword}" via Proxy...`);
  
  // Log da chave (apenas primeiros/últimos chars para segurança)
  const keyPreview = SCRAPER_API_KEY ? `${SCRAPER_API_KEY.slice(0, 4)}...${SCRAPER_API_KEY.slice(-4)}` : 'VAZIA';
  console.log(`[V7] SCRAPER_API_KEY: ${keyPreview} (tamanho: ${SCRAPER_API_KEY?.length || 0})`);
  
  const shopeeUrl = `https://shopee.com.br/api/v4/search/search_items?by=sales&keyword=${encodeURIComponent(keyword)}&limit=${limit}&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
  const proxyUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(shopeeUrl)}`;
  
  console.log(`[V7] URL Shopee: ${shopeeUrl}`);
  console.log(`[V7] URL Proxy (sem chave): http://api.scraperapi.com?api_key=***&url=${encodeURIComponent(shopeeUrl)}`);

  const response = await fetch(proxyUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  console.log(`[V7] Response Status: ${response.status}`);
  console.log(`[V7] Response Headers:`, Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[V7] Erro Detalhado - Status: ${response.status}`);
    console.error(`[V7] Corpo da resposta:`, errorText);
    throw new Error(`[V7] Erro no Proxy ou na API Pública. Status: ${response.status}. Detalhes: ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`[V7] Resposta JSON recebida:`, JSON.stringify(data).slice(0, 200));

  if (data.error) {
    throw new Error(`[V7] Erro interno da Shopee: ${data.error_msg || data.error}`);
  }
  
  console.log(`[V7] ${data.items?.length || 0} produtos brutos coletados.`);
  return (data.items || []).map((item: any) => ({
    itemid: item.itemid,
    shopid: item.shopid,
    name: item.name,
    price: item.price / 100000,
    sold: item.sold,
    rating: item.item_rating?.rating_star ?? 0,
    discount: item.raw_discount,
    images: item.images,
  }));
}

// --- FUNÇÃO 2: ENRIQUECEDOR (API OFICIAL DE AFILIADO) ---
async function gerarLinkAfiliado(productUrl: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const query = `mutation { generateShortLink(productLink: "${productUrl}") { shortLink, commission } }`;
  const payload = JSON.stringify({ query });
  const dataToSign = SHOPEE_APP_ID + timestamp + payload + SHOPEE_SECRET_KEY;

  const signatureBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataToSign));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
    method: "POST",
    headers: {
      "Authorization": `SHA256 Credential=${SHOPEE_APP_ID},Timestamp=${timestamp},Signature=${signatureHex}`,
      "Content-Type": "application/json"
    },
    body: payload,
  });

  if (!response.ok) return null;
  const result = await response.json();
  return result.data?.generateShortLink ?? null;
}

// --- SERVIDOR DA EDGE FUNCTION ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword');
    if (!keyword) throw new Error("A palavra-chave (keyword) é obrigatória.");

    // 1. Buscar produtos na API Pública (usando o proxy)
    const produtosPublicos = await coletarProdutosPublicos(keyword, 50);

    // 2. Processar em paralelo para enriquecer com links de afiliado
    const produtosQualificadosPromises = produtosPublicos.map(async (p: any) => {
      const productUrl = `https://shopee.com.br/product/${p.shopid}/${p.itemid}`;
      const affiliateData = await gerarLinkAfiliado(productUrl);

      if (!affiliateData) return null;

      return {
        id: `shopee_${p.itemid}`,
        name: p.name,
        price: p.price,
        sold: p.sold,
        rating: p.rating,
        discount: p.discount,
        imageUrl: p.images?.[0] ? `https://cf.shopee.com.br/file/${p.images[0]}` : '',
        link_afiliado: affiliateData.shortLink,
        comissao: (affiliateData.commission ?? 0) / 100000,
        platform: 'Shopee'
      };
    });

    const resultados = await Promise.all(produtosQualificadosPromises);
    const produtosFinais = resultados.filter(p => p !== null); // Remove os que falharam

    console.log(`[V7] Processo finalizado. ${produtosFinais.length} produtos qualificados retornados.`);

    return new Response(JSON.stringify({ products: produtosFinais }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[V7] Erro fatal na Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message, products: [] }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
