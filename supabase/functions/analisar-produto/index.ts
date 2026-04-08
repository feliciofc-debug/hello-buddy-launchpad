import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractJsonFromResponse(responseText: string) {
  let cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart === -1) {
    throw new Error('Resposta da IA não contém JSON válido');
  }

  const openingChar = cleaned[jsonStart];
  const closingChar = openingChar === '[' ? ']' : '}';
  const jsonEnd = cleaned.lastIndexOf(closingChar);

  if (jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error('Resposta da IA não contém JSON completo');
  }

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return JSON.parse(repaired);
  }
}

function buildConceptKeywords(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return 'marketing digital, automação, redes sociais';

  const segments = compact
    .split(/[\n,;|]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/^[-–•\d.()\s]+/, '')
        .replace(/\betc\.?$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .map((segment) => segment.slice(0, 48));

  if (segments.length > 0) {
    return segments.slice(0, 6).join(', ');
  }

  return compact.split(/\s+/).slice(0, 12).join(' ');
}

function sanitizePromptLeakage(text: string, sourceInput: string, removeSourceLiteral = false): string {
  let cleaned = text
    .replace(/^(Aqui está|Segue|Claro|Certo|Ok|Entendido|Com certeza)[^\n]*\n*/i, '')
    .replace(/```json\s*/gi, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^(Contexto|Prompt|Descrição|Brief)\s*:\s*/gim, '')
    .replace(/Analise esta imagem[^\n]*contexto[^\n]*:?\s*/gi, '')
    .replace(/basead[oa]s? neste contexto resumido\s*:?\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (removeSourceLiteral) {
    const normalizedSource = sourceInput.replace(/\s+/g, ' ').trim();
    if (normalizedSource.length >= 24) {
      cleaned = cleaned
        .replace(new RegExp(normalizedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }

  return cleaned;
}

function sanitizePostPayload(posts: Record<string, Record<string, string>>, sourceInput: string, removeSourceLiteral = false) {
  const sanitized: Record<string, Record<string, string>> = {};

  for (const [platform, options] of Object.entries(posts || {})) {
    sanitized[platform] = {};

    if (!options || typeof options !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(options)) {
      sanitized[platform][key] = typeof value === 'string'
        ? sanitizePromptLeakage(value, sourceInput, removeSourceLiteral)
        : '';
    }
  }

  return sanitized;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, images = [], source = 'generic' } = await req.json();
    console.log('🔍 Analisando:', url, '| Imagens enviadas:', images.length, '| Source:', source);

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

    // SEMPRE gera imagem quando não é URL (com ou sem logo)
    if (!isUrl) {
      let logoImage: string | null = null;
      
      // Verificar se tem imagens (logo) enviadas
      if (images.length > 0) {
        console.log('🎨 Logo detectada! Gerando imagem COM a logo incorporada...');
        logoImage = images[0]; // Primeira imagem é a logo
      } else {
        console.log('🎨 Nenhuma imagem fornecida, gerando imagem do zero...');
      }

      // SEMPRE gerar uma nova imagem (com ou sem logo)
      let imagePrompt = '';
      const conceptKeywords = buildConceptKeywords(url);
      
      if (logoImage) {
        // Prompt quando TEM logo - instruções mais específicas
        imagePrompt = `Create a professional, eye-catching social media marketing image inspired by these concepts: ${conceptKeywords}. 

CRITICAL INSTRUCTIONS:
1. INCORPORATE the logo/brand from the reference image into the final generated image
2. The logo should be VISIBLE and well-positioned (corner, center, or watermark style)
 3. Create a beautiful, attractive composition (product display, banner, abstract campaign visual, etc.)
4. Use colors that complement the logo
5. Make it suitable for Instagram, Facebook and social media
6. Professional quality, modern design
 7. DO NOT write the user's request, feature list, paragraphs, menus, bullet points, labels or UI copy anywhere in the artwork
 8. NO readable text, NO slogans, NO dashboard labels, NO small print, NO captions rendered inside the image
 9. Communicate through icons, product cards, charts, automation symbols, motion cues, gradients and composition instead of words
 10. If text starts to appear, remove it and replace it with simple visual elements
 11. DO NOT just return the logo - CREATE A NEW MARKETING IMAGE that includes the logo`;

      } else {
        // Prompt quando NÃO tem logo
        imagePrompt = `Create a professional, eye-catching image for social media marketing inspired by these concepts: ${conceptKeywords}. 

INSTRUCTIONS:
1. Make it visually impactful and attractive
2. Suitable for Instagram and Facebook posts
3. Modern, clean design
4. High quality, professional look
 5. Focus on the concept described, but NEVER transcribe the user's prompt into the image
 6. NO readable text, NO feature lists, NO paragraphs, NO labels, NO UI menus, NO bullet points
 7. Use icons, shapes, lighting, product/brand symbolism and composition to communicate the idea
 8. If text starts to appear, remove it and replace it with visual elements only
 9. Keep the final image clean, premium and ready for social posting`;
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
      
      console.log('🎨 Iniciando geração de imagem...', logoImage ? 'COM logo' : 'SEM logo');

      // Chamar API de geração de imagem
      const imageGenResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
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
          throw new Error('Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.');
        }
        
        throw new Error(`Erro ao gerar imagem: ${imageGenResponse.status}`);
      }

      const imageGenData = await imageGenResponse.json();
      console.log('✅ Imagem gerada com sucesso!');
      console.log('🔍 Response da API:', JSON.stringify(imageGenData).substring(0, 200));
      
      // Extrair a imagem gerada (base64)
      const generatedImageUrl = imageGenData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (generatedImageUrl) {
        // Upload base64 para Storage público para que Instagram/Facebook aceitem a URL
        try {
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
          const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabaseStorage = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          // Extrair dados base64 (remover prefixo data:image/...)
          let base64Data = generatedImageUrl;
          let mimeType = 'image/png';
          if (base64Data.startsWith('data:')) {
            const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              base64Data = match[2];
            }
          }
          
          const imageBytes = base64Decode(base64Data);
          const fileName = `ia-marketing/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
          
          const { error: uploadError } = await supabaseStorage.storage
            .from('produtos')
            .upload(fileName, imageBytes, { contentType: mimeType, upsert: true });
          
          if (!uploadError) {
            const { data: publicUrlData } = supabaseStorage.storage
              .from('produtos')
              .getPublicUrl(fileName);
            
            if (publicUrlData?.publicUrl) {
              generatedImage = publicUrlData.publicUrl;
              finalImages = [generatedImage];
              console.log('✅ Imagem salva no Storage público:', generatedImage);
            } else {
              generatedImage = generatedImageUrl;
              finalImages = [generatedImageUrl];
              console.warn('⚠️ Upload OK mas sem URL pública, usando base64');
            }
          } else {
            console.warn('⚠️ Erro no upload para Storage:', uploadError.message);
            generatedImage = generatedImageUrl;
            finalImages = [generatedImageUrl];
          }
        } catch (uploadErr) {
          console.warn('⚠️ Falha ao fazer upload para Storage, usando base64:', uploadErr);
          generatedImage = generatedImageUrl;
          finalImages = [generatedImageUrl];
        }
        
        console.log('🖼️ Imagem gerada adicionada:', generatedImage ? 'SIM' : 'NÃO');
      } else {
        console.warn('⚠️ API retornou sucesso mas sem imagem no response');
        console.warn('⚠️ Estrutura do response:', JSON.stringify(imageGenData));
      }
    }
    
    // Se não for URL e tiver imagens (enviadas ou geradas), usar análise direta de imagem
    if (!isUrl && finalImages.length > 0) {
      console.log('📸 Modo análise de imagem com prompt:', url);
      
      const promptContext = buildConceptKeywords(url);
      const prompt = `Analise esta imagem e crie posts promocionais baseados neste contexto resumido: "${promptContext}"

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

WHATSAPP (3 variações, máximo 280 caracteres cada):
- Opção A: Curto e Direto com urgência. Use emojis estrategicamente.
- Opção B: Amigável com storytelling rápido. Crie conexão emocional.
- Opção C: Com Call-to-Action forte. Senso de oportunidade limitada.

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
  },
  "whatsapp": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
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

      const posts = sanitizePostPayload(
        extractJsonFromResponse(texto) as Record<string, Record<string, string>>,
        url,
        true
      );

      console.log('✅ Posts gerados com sucesso via análise de imagem');

      return new Response(
        JSON.stringify({
          success: true,
          produto: {
            titulo: 'Análise de Imagem',
            preco: '',
            url: '',
            originalUrl: ''
          },
          instagram: posts.instagram,
          facebook: posts.facebook,
          story: posts.story,
          whatsapp: posts.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' },
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

    // 🚀 PILAR 1: Se source é 'shopee', usar API da Shopee
    if (source === 'shopee' && url.includes('shopee.com')) {
      console.log('🛍️ MODO SHOPEE API ATIVADO - Obtendo dados estruturados...');
      
      try {
        // Chamar edge function converter-shopee para obter link de afiliado e dados
        const shopeeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/converter-shopee`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ product_url: url })
        });

        if (!shopeeResponse.ok) {
          console.error('❌ Erro ao converter link Shopee:', shopeeResponse.status);
          throw new Error('Erro ao obter dados da API da Shopee');
        }

        const shopeeData = await shopeeResponse.json();
        console.log('✅ Dados da Shopee API:', shopeeData);

        if (!shopeeData.success) {
          throw new Error(shopeeData.error || 'Erro ao processar produto da Shopee');
        }

        // Extrair dados estruturados
        const titulo = shopeeData.titulo || 'Produto Shopee';
        const preco = shopeeData.preco || '0.00';
        const linkAfiliado = shopeeData.affiliate_link || url;
        const comissao = shopeeData.commission_rate || 'Comissão de afiliado disponível';
        
        // Criar prompt ENRIQUECIDO com dados da API da Shopee
        const promptEnriquecido = `Crie posts promocionais SUPER PERSUASIVOS para o seguinte produto da Shopee:

Produto: ${titulo}
Preço: R$ ${preco}
${comissao ? `Comissão: ${comissao}` : ''}
Link de Afiliado: ${linkAfiliado}

🎯 IMPORTANTE: Este produto está na Shopee, plataforma conhecida por:
- Entrega rápida
- Preços competitivos
- Milhões de avaliações de clientes reais
- Frete grátis em muitos produtos

IDIOMA OBRIGATÓRIO: Todos os textos devem ser em ${detectedLanguage}

Gere 9 variações de posts altamente persuasivos, 3 para cada tipo:

INSTAGRAM (3 variações):
- Opção A: Crie URGÊNCIA! Mencione que é "Oferta da Shopee" e que pode acabar rápido. SEMPRE termine com "🔗 Link na bio!"
- Opção B: Conte uma HISTÓRIA de transformação com o produto. SEMPRE termine com "🔗 Link na bio!"
- Opção C: Use PROVA SOCIAL, mencione "produto top vendas da Shopee". SEMPRE termine com "🔗 Link na bio!"

FACEBOOK (3 variações):
- Opção A: Tom casual mas com CALL-TO-ACTION forte. Mencione "Compre agora na Shopee". SEMPRE inclua o link: ${linkAfiliado}
- Opção B: Estilo informativo com BENEFÍCIOS claros + "Disponível na Shopee com frete grátis". SEMPRE inclua o link: ${linkAfiliado}
- Opção C: PROMOÇÃO/URGÊNCIA! "Últimas unidades na Shopee". SEMPRE inclua o link: ${linkAfiliado}

STORY INSTAGRAM (3 variações, MAX 80 caracteres):
- Opção A: "🔥 SHOPEE em oferta! 🛒✨" + emoji relevante. SEMPRE termine com "🔗 Arrasta pra cima!"
- Opção B: Pergunta + "Tá na Shopee!" SEMPRE termine com "🔗 Link abaixo!"
- Opção C: "⏰ CORRE! Shopee" + urgência. SEMPRE termine com "🔗 Arrasta!"

WHATSAPP (3 variações - CRÍTICO: NUNCA DEIXE VAZIO):
- Opção A: Mensagem CURTA e DIRETA (2 linhas). Formato: "🚨 [Nome do Produto] com desconto na Shopee! [emoji relevante]" + NOVA LINHA + link completo: ${linkAfiliado}
- Opção B: Mensagem AMIGÁVEL e pessoal (3-4 linhas). Formato: "Oi! 👋 [mensagem conversacional sobre o produto]" + NOVA LINHA + link completo: ${linkAfiliado}
- Opção C: Mensagem de URGÊNCIA (2-3 linhas). Formato: "⏰ ÚLTIMAS UNIDADES! [call-to-action forte]" + NOVA LINHA + link completo: ${linkAfiliado}

ATENÇÃO: TODAS as 3 opções de WhatsApp DEVEM ter texto E o link ${linkAfiliado}. NUNCA retorne vazio!

IMPORTANTE:
- TODOS os textos devem estar em ${detectedLanguage}
- Mencione "Shopee" em pelo menos 1 variação de cada plataforma
- Use emojis relacionados a compras online: 🛒 🛍️ 📦 ✨ 🔥 ⚡
- Crie senso de urgência e prova social

Retorne APENAS um JSON válido no formato:
{
  "instagram": {
    "opcaoA": "texto aqui",
    "opcaoB": "texto aqui",
    "opcaoC": "texto aqui"
  },
  "facebook": {
    "opcaoA": "texto aqui + ${linkAfiliado}",
    "opcaoB": "texto aqui + ${linkAfiliado}",
    "opcaoC": "texto aqui + ${linkAfiliado}"
  },
  "story": {
    "opcaoA": "texto curto (max 80 chars)",
    "opcaoB": "texto curto (max 80 chars)",
    "opcaoC": "texto curto (max 80 chars)"
  },
  "whatsapp": {
    "opcaoA": "texto + ${linkAfiliado}",
    "opcaoB": "texto + ${linkAfiliado}",
    "opcaoC": "texto + ${linkAfiliado}"
  }
}`;

        // Chamar IA para gerar posts com dados enriquecidos
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
                { role: 'system', content: `Você é um especialista em marketing digital de e-commerce e afiliados. Gere posts promocionais criativos e persuasivos EXCLUSIVAMENTE em ${detectedLanguage}.` },
                { role: 'user', content: promptEnriquecido }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro na Lovable AI:', response.status, errorText);
          throw new Error(`Erro na IA: ${response.status}`);
        }

        const data = await response.json();
        const texto = data.choices?.[0]?.message?.content || '';
        
        const posts = sanitizePostPayload(
          extractJsonFromResponse(texto) as Record<string, Record<string, string>>,
          url,
          false
        );

        console.log('✅ Posts gerados com dados da Shopee API!');

        return new Response(
          JSON.stringify({
            success: true,
            produto: {
              titulo: titulo,
              preco: preco,
              url: linkAfiliado,
              originalUrl: linkAfiliado,
              imagem: shopeeData.imagem || null
            },
            instagram: posts.instagram,
            facebook: posts.facebook,
            story: posts.story,
            whatsapp: posts.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' },
            shopeeData: {
              commission: comissao,
              source: 'shopee_api'
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );

      } catch (shopeeError) {
        console.error('❌ Erro ao usar API da Shopee:', shopeeError);
        console.log('⚠️ Fallback: usando método de scraping tradicional...');
        // Continuar com scraping normal em caso de erro
      }
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

    // Extrair título, preço e IMAGEM com regex melhorados
    let titulo = '';
    let preco = '';
    let imagem = '';

    // EXTRAÇÃO ESPECÍFICA PARA SHOPEE (JSON embutido na página)
    if (finalUrl.includes('shopee.com')) {
      console.log('🛍️ Detectado: Shopee - Extraindo dados do JSON embutido');
      
      // Shopee coloca todos os dados em um JSON dentro de <script type="application/ld+json">
      const ldJsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (ldJsonMatch) {
        try {
          const jsonData = JSON.parse(ldJsonMatch[1]);
          if (jsonData.name) titulo = jsonData.name;
          if (jsonData.offers?.price) preco = jsonData.offers.price;
          if (jsonData.image) imagem = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image;
          console.log('✅ Dados extraídos do LD+JSON:', { titulo, preco, imagem: !!imagem });
        } catch (e) {
          console.warn('⚠️ Erro ao parsear LD+JSON');
        }
      }
      
      // Fallback: buscar no HTML/JSON da página
      if (!titulo || !preco) {
        // Buscar dados do produto em window.__INITIAL_STATE__ ou similar
        const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            const item = state?.item?.item;
            if (item) {
              if (!titulo && item.name) titulo = item.name;
              if (!preco && item.price) preco = (item.price / 100000).toFixed(2);
              if (!imagem && item.image) imagem = item.image;
              console.log('✅ Dados extraídos do INITIAL_STATE:', { titulo, preco, imagem: !!imagem });
            }
          } catch (e) {
            console.warn('⚠️ Erro ao parsear INITIAL_STATE');
          }
        }
      }
      
      // Fallback 2: Regex nos dados JSON inline
      if (!titulo) {
        const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/) || 
                          html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          titulo = titleMatch[1]
            .replace(/\s+/g, ' ')
            .replace(/[|\-–—].*(Shopee).*$/i, '')
            .trim();
        }
      }
      
      if (!preco) {
        let precoMatch = html.match(/"price_min"\s*:\s*([0-9]+)/) ||
                        html.match(/"price"\s*:\s*([0-9]+)/) ||
                        html.match(/"raw_price"\s*:\s*([0-9]+)/);
        if (precoMatch) {
          preco = (parseInt(precoMatch[1]) / 100000).toFixed(2);
        }
      }
      
      if (!imagem) {
        const imagemMatch = html.match(/"image"\s*:\s*"([^"]+)"/) ||
                           html.match(/"images"\s*:\s*\[\s*"([^"]+)"/);
        if (imagemMatch) {
          imagem = imagemMatch[1];
        }
      }
      
      console.log('💰 Dados finais Shopee:', { titulo, preco, imagem: !!imagem });
      
    } else if (finalUrl.includes('amazon.com')) {
      console.log('📦 Detectado: Amazon');
      
      // Título
      if (!titulo) {
        const titleMatch = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([^<]+)<\/span>/i) ||
                          html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          html.match(/"name"\s*:\s*"([^"]+)"/);
        if (titleMatch) titulo = titleMatch[1].trim();
      }
      
      // Preço
      let precoMatch = html.match(/"price"\s*:\s*"?R?\$?\s*([0-9.,]+)"?/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      if (!precoMatch) precoMatch = html.match(/priceAmount[^>]*>R?\$?\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Amazon extraído:', preco);
      }
      
      // Imagem
      if (!imagem) {
        const imagemMatch = html.match(/"hiRes"\s*:\s*"([^"]+)"/) ||
                           html.match(/data-old-hires=["']([^"']+)["']/) ||
                           html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/);
        if (imagemMatch) imagem = imagemMatch[1];
      }
      
    } else if (finalUrl.includes('mercadolivre.com') || finalUrl.includes('mercadolibre.com')) {
      console.log('🏪 Detectado: Mercado Livre');
      
      // Título
      if (!titulo) {
        const titleMatch = html.match(/<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                          html.match(/"name"\s*:\s*"([^"]+)"/);
        if (titleMatch) titulo = titleMatch[1].trim();
      }
      
      // Preço
      let precoMatch = html.match(/"price"\s*:\s*([0-9.]+)/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço Mercado Livre extraído:', preco);
      }
      
      // Imagem
      if (!imagem) {
        const imagemMatch = html.match(/"secure_url"\s*:\s*"([^"]+\.jpg)/) ||
                           html.match(/data-zoom=["']([^"']+)["']/);
        if (imagemMatch) imagem = imagemMatch[1];
      }
      
    } else {
      console.log('🌐 Marketplace genérico');
      
      // Título genérico
      if (!titulo) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                          html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (titleMatch) titulo = titleMatch[1].trim();
      }
      
      // Preço genérico
      let precoMatch = html.match(/"price"\s*:\s*"?([0-9.,]+)"?/);
      if (!precoMatch) precoMatch = html.match(/R\$\s*([0-9.,]+)/);
      
      if (precoMatch) {
        preco = precoMatch[1].replace('.', '').replace(',', '.');
        console.log('💰 Preço genérico extraído:', preco);
      }
      
      // Imagem genérica
      if (!imagem) {
        const imagemMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/) ||
                           html.match(/<img[^>]*class=["'][^"']*product[^"']*["'][^>]*src=["']([^"']+)["']/);
        if (imagemMatch) imagem = imagemMatch[1];
      }
    }

    console.log('📊 Dados extraídos - Título:', titulo, '| Preço:', preco, '| Imagem:', !!imagem);

    // Validar dados extraídos
    if (!titulo || !preco) {
      console.warn('⚠️ Extração incompleta - Título:', titulo, '| Preço:', preco, '| Imagem:', !!imagem);
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

WHATSAPP (3 variações):
- Opção A: Curto e direto (2-3 linhas max). SEMPRE inclua o link: ${url}
- Opção B: Amigável e conversacional. Use emoji. SEMPRE inclua o link: ${url}
- Opção C: Com call-to-action forte e urgência. SEMPRE inclua o link: ${url}

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
  },
  "whatsapp": {
    "opcaoA": "texto + ${url}",
    "opcaoB": "texto + ${url}",
    "opcaoC": "texto + ${url}"
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

    const posts = sanitizePostPayload(
      extractJsonFromResponse(texto) as Record<string, Record<string, string>>,
      url,
      false
    );

    console.log('✅ Posts gerados com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        produto: {
          titulo: titulo || 'Produto',
          preco: preco || '0.00',
          url: finalUrl,
          originalUrl: url,  // Link original de afiliado
          imagem: imagem || null
        },
        instagram: posts.instagram,
        facebook: posts.facebook,
        story: posts.story,
        whatsapp: posts.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' }
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
