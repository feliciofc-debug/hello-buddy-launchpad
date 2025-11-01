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
    console.log('Analisando URL:', url);

    if (!url) {
      throw new Error('URL não fornecida');
    }

    // 1. BUSCAR DADOS DO PRODUTO USANDO SCRAPER API
    let titulo = 'Produto em Oferta';
    let preco = '99.90';
    let finalUrl = url;

    try {
      // Usar ScraperAPI para bypass de proteções e scraping confiável
      const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY');
      
      if (!SCRAPER_API_KEY) {
        console.error('SCRAPER_API_KEY não configurada');
        throw new Error('Configuração de scraping não disponível');
      }

      // Se for link curto, seguir redirecionamento primeiro
      if (url.includes('amzn.to') || url.includes('a.co') || url.includes('s.shopee.com.br') || url.includes('shp.ee')) {
        console.log('Link curto detectado - seguindo redirecionamento...');
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        finalUrl = redirectResponse.url;
        console.log('URL final após redirecionamento:', finalUrl);
      }

      // Usar ScraperAPI para obter o HTML
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(finalUrl)}`;
      console.log('Fazendo scraping da URL:', finalUrl);
      
      const response = await fetch(scraperUrl);
      
      if (!response.ok) {
        console.error('Erro ao fazer scraping:', response.status, await response.text());
        throw new Error('Erro ao acessar página do produto');
      }
      
      const html = await response.text();

      // PRIORIDADE 1: Tentar extrair de meta tags Open Graph
      const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      const ogPrice = html.match(/<meta\s+property="product:price:amount"\s+content="([^"]+)"/i);
      
      if (ogTitle) {
        titulo = ogTitle[1].trim().substring(0, 100);
        console.log('Título extraído de og:title:', titulo);
      }

      if (ogPrice) {
        preco = ogPrice[1];
        console.log('Preço extraído de product:price:', preco);
      }

      // PRIORIDADE 2: Tentar extrair de JSON-LD (comum no Shopee)
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.name && !ogTitle) {
            titulo = jsonData.name.substring(0, 100);
            console.log('Título extraído de JSON-LD:', titulo);
          }
          if (jsonData.offers?.price && !ogPrice) {
            preco = jsonData.offers.price.toString();
            console.log('Preço extraído de JSON-LD:', preco);
          }
        } catch (e) {
          console.log('Erro ao parsear JSON-LD:', e);
        }
      }

      // PRIORIDADE 3: Fallback para métodos tradicionais
      if (titulo === 'Produto em Oferta') {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                          html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (titleMatch) {
          titulo = titleMatch[1].trim().substring(0, 100);
          console.log('Título extraído de title/h1:', titulo);
        }
      }

      if (preco === '99.90') {
        // Tentar vários padrões de preço - mais específicos para Shopee
        const patterns = [
          // Shopee: price em centavos no HTML
          /"price":(\d+)/,
          // Shopee: priceMin/priceMax
          /"priceMin":(\d+)/,
          // Padrão BR com R$
          /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,
          // Preço em JSON
          /"price":\s*"?(\d+(?:\.\d{2})?)"?/,
          // Data attributes
          /data-price="(\d+(?:\.\d{2})?)"/,
        ];
        
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) {
            let precoStr = match[1];
            // Se for Shopee (número grande sem pontos/vírgulas), converter de centavos
            if (pattern.source.includes('"price"') && precoStr.length > 4 && !precoStr.includes('.') && !precoStr.includes(',')) {
              preco = (parseInt(precoStr) / 100).toFixed(2);
              console.log('Preço extraído de centavos (Shopee):', preco);
            } else {
              preco = precoStr.replace('.', '').replace(',', '.');
              console.log('Preço extraído com padrão:', preco);
            }
            break;
          }
        }
      }

      console.log('Dados finais extraídos:', { titulo, preco, url: finalUrl });
    } catch (error) {
      console.log('Erro ao parsear, usando dados genéricos:', error);
    }

    // 2. GERAR POSTS COM LOVABLE AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const promptInsta = `Produto: ${titulo}, Preço: R$${preco}. 
Crie um post para Instagram (máximo 150 caracteres) com linguagem vendedora, emojis relevantes e call-to-action forte. Seja persuasivo e urgente.`;

    const promptStory = `Produto: ${titulo}, R$${preco}. 
Crie um texto para story do Instagram (máximo 80 caracteres) com senso de urgência e escassez. Use emojis e seja direto.`;

    const promptWhats = `Produto: ${titulo}, R$${preco}. 
Crie uma mensagem para WhatsApp como se fosse um amigo indicando o produto. Seja informal, amigável e convincente (máximo 200 caracteres).`;

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
            { role: 'system', content: 'Você é um especialista em copywriting para afiliados. Crie textos persuasivos e vendedores.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
        }
        if (response.status === 402) {
          throw new Error('Créditos esgotados. Adicione créditos ao workspace.');
        }
        const errorText = await response.text();
        console.error('Erro na API Lovable AI:', response.status, errorText);
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

    console.log('Posts gerados com sucesso');

    // 3. RETORNAR
    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo,
          preco,
          url
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
    console.error('Erro na função analisar-produto:', error);
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
