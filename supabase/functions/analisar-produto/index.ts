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
    const { url, images = [] } = await req.json();
    console.log('🔍 Analisando:', url, '| Imagens enviadas:', images.length);

    if (!url) {
      throw new Error('Texto ou URL não fornecido');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    let finalImages = images;
    let generatedImage: string | null = null;

    // Verificar se é uma URL válida ou apenas um prompt de texto
    const isUrl = url.match(/^https?:\/\//i);
    
    // DETECTAR IDIOMA DO PROMPT DO USUÁRIO
    const detectLanguage = (text: string): string => {
      const portugueseWords = /\b(produto|oferta|comprar|preço|promoção|desconto|grátis)\b/i;
      const englishWords = /\b(product|offer|buy|price|promotion|discount|free)\b/i;
      
      if (portugueseWords.test(text)) return 'português brasileiro';
      if (englishWords.test(text)) return 'english';
      
      // Detectar por acentuação/caracteres especiais
      if (/[àáâãäçèéêëìíîïòóôõöùúûü]/i.test(text)) return 'português brasileiro';
      
      return 'português brasileiro'; // Default
    };

    const detectedLanguage = detectLanguage(url);
    console.log('🌍 Idioma detectado:', detectedLanguage);

    // NOVO: Se não for URL e NÃO tiver imagens, GERAR a imagem com IA
    // OU se tiver imagens (logo), GERAR nova imagem COM a logo
    if (!isUrl) {
      let logoImage: string | null = null;
      
      // Se tem imagens enviadas, a primeira pode ser uma logo
      if (images.length > 0) {
        console.log('🎨 Logo detectada! Gerando imagem com a logo...');
        logoImage = images[0];
      } else {
        console.log('🎨 Nenhuma imagem fornecida, gerando imagem com IA...');
      }

      // PROMPT MELHORADO para geração de imagem
      let imagePrompt = '';
      
      if (logoImage) {
        // Se tem logo, criar imagem de produto COM a logo
        imagePrompt = `Create a professional, eye-catching social media marketing image based on this description: "${url}". 

CRITICAL INSTRUCTIONS:
1. Include the logo/brand mark from the reference image prominently in the final image
2. The logo should be clearly visible and well-positioned (top corner or center)
3. Create a modern, attractive product mockup or promotional banner
4. Use colors that complement the logo
5. Make it suitable for Instagram, Facebook and social media posts
6. Professional quality, high resolution
7. Text on image should be in ${detectedLanguage}
8. If including text/slogans, use ${detectedLanguage} language`;
      } else {
        // Se não tem logo, gerar imagem normal
        imagePrompt = `Create a professional, eye-catching image for social media marketing based on this description: "${url}". 

INSTRUCTIONS:
1. Make it visually impactful and attractive
2. Suitable for Instagram and Facebook posts
3. Modern, clean design
4. High quality, professional look
5. Any text or slogans on the image MUST be in ${detectedLanguage}
6. Focus on the product/concept described`;
      }
      
      const imageGenMessages: any[] = [
        {
          role: "user",
          content: logoImage 
            ? [
                {
                  type: 'image_url',
                  image_url: { url: logoImage }
                },
                {
                  type: 'text',
                  text: imagePrompt
                }
              ]
            : imagePrompt
        }
      ];
      
      const imageGenResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: imageGenMessages,
          modalities: ["image", "text"]
        }),
      });

      if (!imageGenResponse.ok) {
        const errorText = await imageGenResponse.text();
        console.error('❌ Erro ao gerar imagem:', errorText);
        
        if (imageGenResponse.status === 429) {
          throw new Error('Limite de geração de imagens atingido. Aguarde alguns segundos.');
        }
        if (imageGenResponse.status === 402) {
          throw new Error('Créditos insuficientes para gerar imagem. Adicione créditos em Settings -> Workspace -> Usage.');
        }
        
        throw new Error(`Erro ao gerar imagem: ${imageGenResponse.status}`);
      }

      const imageGenData = await imageGenResponse.json();
      console.log('✅ Imagem gerada com sucesso', logoImage ? 'COM logo' : 'sem logo');
      
      // Extrair a imagem gerada (base64)
      const generatedImageUrl = imageGenData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (generatedImageUrl) {
        finalImages = [generatedImageUrl];
        generatedImage = generatedImageUrl;
        console.log('🖼️ Imagem gerada adicionada para análise');
      }
    }
    
    // Se não for URL e tiver imagens (enviadas ou geradas), usar análise direta de imagem
    if (!isUrl && finalImages.length > 0) {
      console.log('📸 Modo análise de imagem com prompt:', url);
      
      const prompt = `Analise esta imagem e crie posts promocionais baseados neste contexto: "${url}"

IDIOMA OBRIGATÓRIO: Todos os textos devem ser em ${detectedLanguage}

Gere 9 variações de posts, 3 para cada tipo:

INSTAGRAM (3 variações):
- Opção A: Estilo direto/urgente com call-to-action forte. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"
- Opção B: Estilo storytelling, conte uma história. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"
- Opção C: Estilo educativo, ensine algo relacionado ao produto. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"

FACEBOOK (3 variações):
- Opção A: Casual/amigável, tom de conversa
- Opção B: Profissional/informativo com dados e benefícios
- Opção C: Promocional/vendedor com senso de urgência

STORY INSTAGRAM (3 variações, MAX 80 caracteres cada):
- Opção A: Curto e impactante com emoji. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"
- Opção B: Pergunta interativa para engajamento. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"
- Opção C: Contagem regressiva ou urgência. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"

IMPORTANTE: 
- TODOS os textos devem estar em ${detectedLanguage}
- Use emojis apropriados
- Mantenha o tom adequado para cada rede social

Retorne APENAS um JSON válido no formato:
{
  "instagram": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "facebook": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "story": {
    "opcaoA": "texto curto aqui (max 80 chars)",
    "opcaoB": "texto curto aqui (max 80 chars)",
    "opcaoC": "texto curto aqui (max 80 chars)"
  }
}`;

      const messages: any[] = [
        { 
          role: 'system', 
          content: `Você é um especialista em marketing digital e branding. Analise imagens e crie posts promocionais criativos EXCLUSIVAMENTE em ${detectedLanguage}.` 
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: finalImages[0] // Primeira imagem (gerada ou enviada)
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ];

      const response = await fetch(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na Lovable AI:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('Limite de requisições atingido. Aguarde alguns segundos e tente novamente.');
        }
        if (response.status === 402) {
          throw new Error('Créditos insuficientes. Adicione créditos em Settings -> Workspace -> Usage.');
        }
        
        throw new Error(`Erro na IA: ${response.status}`);
      }

      const data = await response.json();
      const texto = data.choices?.[0]?.message?.content || '';
      
      console.log('Resposta da Lovable AI:', texto);

      // Remover markdown code blocks se houver
      let textoLimpo = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      console.log('Texto após remover markdown:', textoLimpo);

      // Extrair JSON da resposta
      const jsonMatch = textoLimpo.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta da IA não contém JSON válido');
      }

      let jsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
      console.log('JSON limpo para parse:', jsonString);

      const posts = JSON.parse(jsonString);

      console.log('✅ Posts gerados com sucesso via análise de imagem');

      return new Response(
        JSON.stringify({
          success: true,
          produto: {
            titulo: 'Análise de Imagem',
            preco: '',
            url: '',
            originalUrl: url
          },
          instagram: posts.instagram,
          facebook: posts.facebook,
          story: posts.story,
          generatedImage: generatedImage // Incluir imagem gerada se houver
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Se chegou aqui, é uma URL de produto - fazer scraping
    if (!isUrl) {
      throw new Error('Por favor, forneça um link de produto válido ou uma imagem para análise.');
    }

    // Seguir redirect se for link curto
    let finalUrl = url;
    if (url.includes('shope.ee') || url.includes('amzn.to') || url.includes('s.shopee')) {
      console.log('🔗 Link curto detectado, seguindo redirect...');
      try {
        const redirectResponse = await fetch(url, { 
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        finalUrl = redirectResponse.url;
        console.log('📍 URL final:', finalUrl);
      } catch (e) {
        console.log('⚠️ Erro ao seguir redirect, usando URL original');
      }
    }

    let html = '';
    
    // TENTAR FETCH DIRETO PRIMEIRO (funciona na maioria dos casos)
    try {
      console.log('🌐 Tentando acesso direto...');
      const directResponse = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (directResponse.ok) {
        html = await directResponse.text();
        console.log('✅ Acesso direto OK, HTML:', html.length, 'bytes');
      } else {
        throw new Error(`Acesso direto bloqueado: ${directResponse.status}`);
      }
    } catch (directError) {
      console.log('⚠️ Acesso direto falhou, usando ScraperAPI...');
      
      const SCRAPER_API_KEY = Deno.env.get('SCRAPER_API_KEY');
      if (!SCRAPER_API_KEY) {
        throw new Error('Não foi possível acessar este produto. Configure SCRAPER_API_KEY.');
      }

      // Usar ScraperAPI sem ultra_premium (que requer plano premium)
      const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(finalUrl)}&render=true`;
      const scraperResponse = await fetch(scraperUrl);
      
      if (!scraperResponse.ok) {
        const errorText = await scraperResponse.text();
        console.error('❌ ScraperAPI erro:', errorText);
        throw new Error(`Não foi possível acessar este produto (${scraperResponse.status}). Tente outro link ou atualize seu plano do ScraperAPI.`);
      }
      
      html = await scraperResponse.text();
      console.log('✅ ScraperAPI OK, HTML:', html.length, 'bytes');
    }

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
      
      let precoMatch = html.match(/"price_min"\s*:\s*([0-9]+)/);
      if (!precoMatch) precoMatch = html.match(/"price"\s*:\s*([0-9]+)/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      
      if (precoMatch) {
        let precoRaw = precoMatch[1].replace(/[.,]/g, '');
        // Shopee usa centavos multiplicados por 100000
        preco = (parseInt(precoRaw) / 100000).toFixed(2);
        console.log('💰 Preço Shopee extraído:', preco);
      }
      
    } else if (finalUrl.includes('amazon.com')) {
      console.log('📦 Detectado: Amazon');
      
      let precoMatch = html.match(/"price"\s*:\s*"?R?\$?\s*([0-9.,]+)"?/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/priceAmount[^>]*>R?\$?\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Amazon extraído:', preco);
      }
      
    } else if (finalUrl.includes('mercadolivre.com') || finalUrl.includes('mercadolibre.com')) {
      console.log('🏪 Detectado: Mercado Livre');
      
      let precoMatch = html.match(/"price"\s*:\s*([0-9.]+)/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Mercado Livre extraído:', preco);
      }
      
    } else {
      console.log('🌐 Marketplace genérico');
      
      let precoMatch = html.match(/"price"\s*:\s*"?([0-9.,]+)"?/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço genérico extraído:', preco);
      }
    }

    console.log('📊 Dados extraídos - Título:', titulo, '| Preço:', preco);

    // Validar dados extraídos
    if (!titulo || !preco) {
      console.warn('⚠️ Extração incompleta - Título:', titulo, '| Preço:', preco);
    }

    // Gerar posts com IA usando Gemini
    const nomeProduto = titulo || 'este produto incrível';
    const precoProduto = preco ? `R$ ${preco}` : 'preço promocional';

    const prompt = `Crie posts promocionais para o seguinte produto:

Produto: ${nomeProduto}
Preço: ${precoProduto}
Link: ${url}

IDIOMA OBRIGATÓRIO: Todos os textos devem ser em ${detectedLanguage}

Gere 9 variações de posts, 3 para cada tipo:

INSTAGRAM (3 variações):
- Opção A: Estilo direto/urgente com call-to-action forte. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"
- Opção B: Estilo storytelling, conte uma história. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"
- Opção C: Estilo educativo, ensine algo relacionado ao produto. SEMPRE termine com "🔗 Link na bio!" ou "🔗 Link nos comentários!"

FACEBOOK (3 variações):
- Opção A: Casual/amigável, tom de conversa. SEMPRE inclua o link completo no final: ${url}
- Opção B: Profissional/informativo com dados e benefícios. SEMPRE inclua o link completo no final: ${url}
- Opção C: Promocional/vendedor com senso de urgência. SEMPRE inclua o link completo no final: ${url}

STORY INSTAGRAM (3 variações, MAX 80 caracteres cada):
- Opção A: Curto e impactante com emoji. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"
- Opção B: Pergunta interativa para engajamento. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"
- Opção C: Contagem regressiva ou urgência. SEMPRE termine com "🔗 Arrasta pra cima!" ou "Link abaixo!"

IMPORTANTE: 
- TODOS os textos devem estar em ${detectedLanguage}
- Instagram e Story: NÃO incluir o link no texto (apenas mencionar "link na bio")
- Facebook: SEMPRE incluir o link completo no final do texto

Retorne APENAS um JSON válido no formato:
{
  "instagram": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "facebook": {
    "opcaoA": "texto aqui + ${url}",
    "opcaoB": "texto aqui + ${url}",
    "opcaoC": "texto aqui + ${url}"
  },
  "story": {
    "opcaoA": "texto curto aqui (max 80 chars)",
    "opcaoB": "texto curto aqui (max 80 chars)",
    "opcaoC": "texto curto aqui (max 80 chars)"
  }
}`;

    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `Você é um especialista em marketing digital. Gere posts promocionais criativos EXCLUSIVAMENTE em ${detectedLanguage}.` },
            { role: 'user', content: prompt }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições atingido. Aguarde alguns segundos e tente novamente.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos em Settings -> Workspace -> Usage.');
      }
      
      throw new Error(`Erro na IA: ${response.status}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || '';
    
    console.log('Resposta da Lovable AI:', texto);

    // Remover markdown code blocks se houver
    let textoLimpo = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    console.log('Texto após remover markdown:', textoLimpo);

    // Extrair JSON da resposta
    const jsonMatch = textoLimpo.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta da IA não contém JSON válido');
    }

    // Remover vírgulas antes de chaves de fechamento
    let jsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
    console.log('JSON limpo para parse:', jsonString);

    const posts = JSON.parse(jsonString);

    console.log('✅ Posts gerados com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo: titulo || 'Produto',
          preco: preco || '0.00',
          url: finalUrl,
          originalUrl: url  // Link original de afiliado
        },
        instagram: posts.instagram,
        facebook: posts.facebook,
        story: posts.story
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
