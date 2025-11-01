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

    // 1. BUSCAR DADOS REAIS DO PRODUTO
    let titulo = 'Produto em Oferta';
    let preco = '99.90';
    let finalUrl = url;

    const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY');
    if (!SCRAPER_API_KEY) {
      console.error('❌ SCRAPER_API_KEY não configurada');
      throw new Error('Configuração de scraping não disponível');
    }

    try {
      // Seguir redirecionamento se for link curto
      if (url.includes('amzn.to') || url.includes('a.co') || url.includes('s.shopee.com.br') || url.includes('shp.ee')) {
        console.log('🔗 Link curto - seguindo redirecionamento...');
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow'
        });
        finalUrl = redirectResponse.url;
        console.log('✅ URL final:', finalUrl);
      }

      // USAR SCRAPER API PARA OBTER HTML REAL
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(finalUrl)}&render=true`;
      console.log('🔍 Buscando dados do produto via ScraperAPI...');
      
      const response = await fetch(scraperUrl, {
        headers: {
          'Accept': 'text/html',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro ScraperAPI:', response.status, errorText);
        throw new Error(`Erro ao acessar produto: ${response.status}`);
      }

      const html = await response.text();
      console.log('✅ HTML recebido, tamanho:', html.length);

      // EXTRAIR TÍTULO
      const titlePatterns = [
        /<meta\s+property="og:title"\s+content="([^"]+)"/i,
        /<title[^>]*>([^<]+)<\/title>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
      ];

      for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          titulo = match[1].trim().substring(0, 100);
          console.log('✅ Título encontrado:', titulo);
          break;
        }
      }

      // EXTRAIR PREÇO - SHOPEE USA CENTAVOS EM JSON
      const pricePatterns = [
        // Shopee: "price":8000 (80.00 reais em centavos)
        /"price":(\d+)/,
        // Shopee: "priceMin":8000
        /"priceMin":(\d+)/,
        // Open Graph
        /<meta\s+property="product:price:amount"\s+content="([^"]+)"/i,
        // Padrão brasileiro R$
        /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/,
      ];

      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let precoStr = match[1];
          
          // Se for número puro grande (Shopee em centavos)
          if (/^\d+$/.test(precoStr) && precoStr.length > 3) {
            preco = (parseInt(precoStr) / 100).toFixed(2);
            console.log('✅ Preço extraído (centavos):', precoStr, '=', preco);
          } 
          // Se for formato brasileiro R$ 80,00
          else if (precoStr.includes(',')) {
            preco = precoStr.replace(/\./g, '').replace(',', '.');
            console.log('✅ Preço extraído (BR):', preco);
          }
          // Já está em formato correto
          else {
            preco = precoStr;
            console.log('✅ Preço extraído:', preco);
          }
          break;
        }
      }

      console.log('📊 DADOS FINAIS:', { titulo, preco, url: finalUrl });

    } catch (error) {
      console.error('❌ ERRO ao buscar dados:', error);
      throw new Error('Não foi possível analisar o produto. Tente outro link.');
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
