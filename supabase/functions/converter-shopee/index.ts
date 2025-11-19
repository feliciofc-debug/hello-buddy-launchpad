import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { product_url } = await req.json();

    if (!product_url || !product_url.includes('shopee.com')) {
      throw new Error('URL inválida da Shopee');
    }

    // Credenciais Shopee das variáveis de ambiente
    const PARTNER_ID = parseInt(Deno.env.get('SHOPEE_APP_ID') || '0');
    const PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
    
    if (!PARTNER_ID || !PARTNER_KEY) {
      throw new Error('Credenciais da Shopee não configuradas');
    }
    
    console.log('[SHOPEE] Usando credenciais:', { PARTNER_ID });
    
    // Timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Path da API
    const path = '/api/v3/affiliate/product_link/create';
    
    // Criar assinatura HMAC-SHA256
    const baseString = `${PARTNER_ID}${path}${timestamp}`;
    const sign = createHmac('sha256', PARTNER_KEY)
      .update(baseString)
      .digest('hex');

    console.log('[SHOPEE] Convertendo link:', product_url);

    // Chamar API Shopee
    const apiUrl = `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_link: product_url,
        sub_id: 'amz_' + Date.now()
      })
    });

    const data = await response.json();
    console.log('[SHOPEE] Resposta da API:', JSON.stringify(data));

    if (data.error || !data.data) {
      console.error('[SHOPEE] Erro na API:', data.message || data);
      throw new Error(data.message || 'Erro ao converter link Shopee');
    }

    // Extrair dados do produto via scraping do HTML
    let titulo = 'Produto Shopee';
    let preco = '0.00';
    let imagem = null;
    
    try {
      // Seguir redirect do link curto se necessário
      let finalUrl = product_url;
      if (product_url.includes('shope.ee') || product_url.includes('s.shopee')) {
        const redirectResponse = await fetch(product_url, { redirect: 'follow' });
        finalUrl = redirectResponse.url;
      }
      
      console.log('[SHOPEE] Fazendo scraping da URL:', finalUrl);
      
      // Usar ScraperAPI para obter o HTML renderizado
      const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY');
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(finalUrl)}&render=true`;
      
      const htmlResponse = await fetch(scraperUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        console.log('[SHOPEE] HTML obtido com sucesso, tamanho:', html.length);
        
        // Tentar extrair dados do __INITIAL_STATE__ (formato usado pela Shopee)
        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            console.log('[SHOPEE] __INITIAL_STATE__ encontrado');
            
            // Navegar na estrutura para encontrar os dados do item
            const item = state?.item?.item;
            if (item) {
              titulo = item.name || titulo;
              
              // Preço na Shopee (dividido por 100000)
              if (item.price_min) {
                preco = (item.price_min / 100000).toFixed(2);
              } else if (item.price) {
                preco = (item.price / 100000).toFixed(2);
              }
              
              // Imagem
              if (item.image) {
                imagem = `https://cf.shopee.com.br/file/${item.image}`;
              } else if (item.images && item.images[0]) {
                imagem = `https://cf.shopee.com.br/file/${item.images[0]}`;
              }
              
              console.log('[SHOPEE] Dados extraídos do __INITIAL_STATE__:', { titulo, preco, imagem: !!imagem });
            }
          } catch (jsonError) {
            console.warn('[SHOPEE] Erro ao parsear __INITIAL_STATE__:', jsonError);
          }
        }
        
        // Se não conseguiu pelo __INITIAL_STATE__, tentar outros métodos
        if (titulo === 'Produto Shopee') {
          // Tentar LD+JSON
          const ldJsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
          if (ldJsonMatch) {
            try {
              const ldJson = JSON.parse(ldJsonMatch[1]);
              if (ldJson.name) titulo = ldJson.name;
              if (ldJson.offers?.price) preco = parseFloat(ldJson.offers.price).toFixed(2);
              if (ldJson.image) imagem = Array.isArray(ldJson.image) ? ldJson.image[0] : ldJson.image;
              console.log('[SHOPEE] Dados extraídos do LD+JSON');
            } catch (e) {
              console.warn('[SHOPEE] Erro ao parsear LD+JSON:', e);
            }
          }
          
          // Fallback: regex patterns
          if (titulo === 'Produto Shopee') {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              titulo = titleMatch[1]
                .replace(/\s+/g, ' ')
                .replace(/[|\-–—].*(Shopee).*$/i, '')
                .replace(/\s*\|\s*Shopee\s*Brasil/i, '')
                .trim();
            }
          }
          
          if (preco === '0.00') {
            // Tentar vários padrões de preço
            const precoPatterns = [
              /"price_min"\s*:\s*(\d+)/,
              /"price"\s*:\s*(\d+)/,
              /R\$\s*([\d.,]+)/,
              /"priceCurrency":"BRL","price":"([\d.]+)"/
            ];
            
            for (const pattern of precoPatterns) {
              const match = html.match(pattern);
              if (match) {
                const valor = match[1].replace(/\./g, '').replace(',', '.');
                const numero = parseFloat(valor);
                
                // Se for um valor muito grande, provavelmente está em centavos * 100000
                if (numero > 100000) {
                  preco = (numero / 100000).toFixed(2);
                } else {
                  preco = numero.toFixed(2);
                }
                break;
              }
            }
          }
          
          if (!imagem) {
            const imagemPatterns = [
              /"image"\s*:\s*"([^"]+)"/,
              /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /"images"\s*:\s*\[\s*"([^"]+)"/
            ];
            
            for (const pattern of imagemPatterns) {
              const match = html.match(pattern);
              if (match) {
                imagem = match[1];
                if (!imagem.startsWith('http')) {
                  imagem = `https://cf.shopee.com.br/file/${imagem}`;
                }
                break;
              }
            }
          }
        }
        
        console.log('[SHOPEE] Dados finais extraídos:', { titulo, preco, imagem: !!imagem });
      } else {
        console.error('[SHOPEE] Erro ao obter HTML:', htmlResponse.status);
      }
    } catch (scrapingError) {
      console.error('[SHOPEE] Erro ao fazer scraping:', scrapingError);
    }
    
    const resultado = {
      success: true,
      affiliate_link: data.data.short_link || data.data.affiliate_link || product_url,
      commission_rate: data.data.commission_rate || '15%',
      titulo,
      preco,
      imagem
    };

    console.log('[SHOPEE] Link convertido com sucesso:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[SHOPEE] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
