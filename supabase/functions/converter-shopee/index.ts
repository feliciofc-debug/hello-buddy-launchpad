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

    // Extrair dados do produto via scraping do HTML (fallback)
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
      const htmlResponse = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        
        // Extrair título
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                          html.match(/"name"\s*:\s*"([^"]+)"/);
        if (titleMatch) {
          titulo = titleMatch[1].replace(/\s+/g, ' ').replace(/[|\-–—].*(Shopee).*$/i, '').trim();
        }
        
        // Extrair preço (Shopee usa centavos * 100000)
        let precoMatch = html.match(/"price_min"\s*:\s*([0-9]+)/);
        if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*([0-9]+)/);
        if (precoMatch) {
          preco = (parseInt(precoMatch[1]) / 100000).toFixed(2);
        }
        
        // Extrair imagem
        const imagemMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
        if (imagemMatch) {
          imagem = imagemMatch[1];
        }
        
        console.log('[SHOPEE] Dados extraídos:', { titulo, preco, imagem: !!imagem });
      }
    } catch (scrapingError) {
      console.warn('[SHOPEE] Erro ao fazer scraping:', scrapingError);
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
