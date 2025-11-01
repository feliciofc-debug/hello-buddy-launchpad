import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log('🔍 Analisando produto:', url);

    if (!url) {
      throw new Error('URL não fornecida');
    }

    const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY');
    if (!SCRAPER_API_KEY) {
      throw new Error('SCRAPER_API_KEY não configurada');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Seguir redirect se for link curto
    let finalUrl = url;
    if (url.includes('shope.ee') || url.includes('amzn.to')) {
      console.log('🔗 Link curto detectado, seguindo redirect...');
      const redirectResponse = await fetch(url, { redirect: 'follow' });
      finalUrl = redirectResponse.url;
      console.log('📍 URL final:', finalUrl);
    }

    // Fazer scraping com ScraperAPI
    const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(finalUrl)}&render=true`;
    console.log('🌐 Fazendo scraping...');
    
    const scraperResponse = await fetch(scraperUrl);
    if (!scraperResponse.ok) {
      throw new Error(`Erro no scraping: ${scraperResponse.status}`);
    }

    const html = await scraperResponse.text();
    console.log('✅ HTML obtido, tamanho:', html.length);

    // Extrair título e preço com regex melhorados
    let titulo = '';
    let preco = '';

    // EXTRAÇÃO DE TÍTULO
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/"name"\s*:\s*"([^"]+)"/);
    
    if (titleMatch) {
      titulo = titleMatch[1]
        .replace(/\s+/g, ' ')
        .replace(/[|\-–—].*(Amazon|Shopee|Mercado\s*Livre).*$/i, '')
        .trim();
    }

    // EXTRAÇÃO DE PREÇO - ESPECÍFICO POR MARKETPLACE
    if (finalUrl.includes('shopee.com')) {
      console.log('🛍️ Detectado: Shopee');
      
      // Tentar várias formas de extrair preço do Shopee
      let precoMatch = html.match(/₫\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*([0-9]+)/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/price_min"\s*:\s*([0-9]+)/);
      
      if (precoMatch) {
        let precoRaw = precoMatch[1].replace(/[.,]/g, '');
        // Shopee usa centavos multiplicados por 100000
        preco = (parseInt(precoRaw) / 100000).toFixed(2);
        console.log('💰 Preço Shopee extraído:', preco);
      }
      
    } else if (finalUrl.includes('amazon.com')) {
      console.log('📦 Detectado: Amazon');
      
      // Regex para Amazon
      let precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*"R?\$?\s*([0-9.,]+)"/);
      if (!precoMatch) precoMatch = html.match(/priceAmount[^>]*>R?\$?\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Amazon extraído:', preco);
      }
      
    } else if (finalUrl.includes('mercadolivre.com') || finalUrl.includes('mercadolibre.com')) {
      console.log('🏪 Detectado: Mercado Livre');
      
      let precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*([0-9.]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Mercado Livre extraído:', preco);
      }
      
    } else {
      console.log('🌐 Marketplace genérico');
      
      // Regex genérico para outros sites
      let precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*"?([0-9.,]+)"?/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço genérico extraído:', preco);
      }
    }

    console.log('📊 Dados extraídos - Título:', titulo, '| Preço:', preco);

    // Gerar posts com IA usando os dados reais
    const promptInsta = `Crie um post vendedor para Instagram sobre este produto:
Produto: ${titulo}
Preço: R$ ${preco}

Use linguagem urgente, emojis relevantes e call-to-action forte.
Máximo 150 caracteres.`;

    const promptStory = `Crie um texto curto e impactante para story do Instagram:
Produto: ${titulo}
Preço: R$ ${preco}

Use senso de urgência e escassez.
Máximo 80 caracteres.`;

    const promptWhats = `Crie uma mensagem amigável para WhatsApp:
Produto: ${titulo}
Preço: R$ ${preco}

Tom informal como se fosse um amigo indicando.
Máximo 200 caracteres.`;

    const generateText = async (prompt: string) => {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um especialista em copywriting para afiliados. Crie textos persuasivos e atrativos.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar conteúdo com IA');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    };

    const [textoInsta, textoStory, textoWhats] = await Promise.all([
      generateText(promptInsta),
      generateText(promptStory),
      generateText(promptWhats)
    ]);

    console.log('✅ Posts gerados com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo,
          preco,
          url: finalUrl
        },
        posts: {
          instagram: textoInsta,
          story: textoStory,
          whatsapp: textoWhats
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na função analisar-produto:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
