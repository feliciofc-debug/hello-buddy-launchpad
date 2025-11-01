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
    const { affiliateUrl } = await req.json();

    if (!affiliateUrl) {
      throw new Error('affiliateUrl é obrigatório');
    }

    const scraperApiKey = Deno.env.get('SCRAPER_API_KEY');
    if (!scraperApiKey) {
      throw new Error('SCRAPER_API_KEY não configurada');
    }

    console.log('[SCRAPE-LOMADEE] Iniciando scraping de:', affiliateUrl);

    // Usar ScraperAPI para evitar bloqueios
    const scraperUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(affiliateUrl)}&render=true`;
    
    const response = await fetch(scraperUrl, {
      headers: {
        'Content-Type': 'text/html',
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao fazer scraping: ${response.status}`);
    }

    const html = await response.text();
    console.log('[SCRAPE-LOMADEE] HTML recebido, tamanho:', html.length);

    // Parser genérico de produtos (tenta identificar padrões comuns)
    const products: any[] = [];

    // Padrão 1: Buscar por meta tags de produtos (Open Graph, Schema.org)
    const ogProductRegex = /<meta[^>]*property="og:product:price:amount"[^>]*content="([^"]*)"/gi;
    const ogTitleRegex = /<meta[^>]*property="og:title"[^>]*content="([^"]*)"/gi;
    const ogImageRegex = /<meta[^>]*property="og:image"[^>]*content="([^"]*)"/gi;

    // Padrão 2: Buscar por JSON-LD de produtos
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis;
    const jsonLdMatches = html.matchAll(jsonLdRegex);
    
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        // Se for um produto ou lista de produtos
        if (jsonData['@type'] === 'Product') {
          products.push(extractProductFromJsonLd(jsonData, affiliateUrl));
        } else if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement) {
          jsonData.itemListElement.forEach((item: any) => {
            if (item['@type'] === 'Product' || item.item?.['@type'] === 'Product') {
              products.push(extractProductFromJsonLd(item.item || item, affiliateUrl));
            }
          });
        }
      } catch (e) {
        console.log('[SCRAPE-LOMADEE] Erro ao parsear JSON-LD:', e);
      }
    }

    // Padrão 3: Buscar por estruturas HTML comuns de e-commerce
    if (products.length === 0) {
      // Tentar extrair de cards de produto comuns
      const productCardRegex = /<div[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)<\/div>/gis;
      const cardMatches = html.matchAll(productCardRegex);
      
      let count = 0;
      for (const cardMatch of cardMatches) {
        if (count >= 20) break; // Limitar a 20 produtos
        
        const cardHtml = cardMatch[0];
        
        // Extrair título
        const titleMatch = cardHtml.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>|<a[^>]*title="([^"]*)"/) || 
                          cardHtml.match(/alt="([^"]*)"/);
        const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').replace(/<[^>]*>/g, '').trim() : null;
        
        // Extrair preço
        const priceMatch = cardHtml.match(/R\$\s*(\d+[.,]\d+)|(\d+[.,]\d+)/);
        const price = priceMatch ? parseFloat(priceMatch[1]?.replace(',', '.') || priceMatch[2]?.replace(',', '.') || '0') : null;
        
        // Extrair imagem
        const imgMatch = cardHtml.match(/<img[^>]*src="([^"]*)"/);
        const image = imgMatch ? imgMatch[1] : null;
        
        // Extrair link do produto
        const linkMatch = cardHtml.match(/<a[^>]*href="([^"]*)"/);
        let productUrl = linkMatch ? linkMatch[1] : affiliateUrl;
        
        // Garantir URL completa
        if (productUrl && !productUrl.startsWith('http')) {
          const baseUrl = new URL(affiliateUrl);
          productUrl = productUrl.startsWith('/') 
            ? `${baseUrl.origin}${productUrl}` 
            : `${baseUrl.origin}/${productUrl}`;
        }
        
        if (title && price && image) {
          products.push({
            id: `scraped-${count}`,
            name: title,
            price: price,
            image: image.startsWith('http') ? image : new URL(image, affiliateUrl).href,
            url: productUrl,
            category: 'Produtos'
          });
          count++;
        }
      }
    }

    console.log(`[SCRAPE-LOMADEE] Total de produtos extraídos: ${products.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        products,
        total: products.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('[SCRAPE-LOMADEE] Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao fazer scraping da loja',
        products: []
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

function extractProductFromJsonLd(jsonData: any, baseUrl: string): any {
  return {
    id: jsonData.sku || jsonData['@id'] || Math.random().toString(36),
    name: jsonData.name || 'Produto',
    price: parseFloat(jsonData.offers?.price || jsonData.price || '0'),
    image: jsonData.image?.[0] || jsonData.image || jsonData.thumbnail || '',
    url: jsonData.url || baseUrl,
    category: jsonData.category || 'Produtos',
    brand: jsonData.brand?.name || ''
  };
}
