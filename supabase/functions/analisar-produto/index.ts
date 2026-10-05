import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  colorsFromLogoDataUrl,
  dataUrlToImageBytes,
  loadTenantBrandAssets,
} from "../_shared/brand-assets.ts";
import { generateMarketingImage } from "../_shared/marketing-image-generator.ts";
import {
  fetchBrandSiteIdentity,
  type BrandSiteIdentity,
} from "../_shared/brand-site-identity.ts";
import { setTenantLogo } from "../_shared/tenant-logo.ts";
import { trimLogoImage } from "../_shared/logo-image-trim.ts";
import { imageUploadMetadata } from "../_shared/image-file-format.ts";

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

  // Se for uma frase única (sem separadores), preserva o prompt INTEIRO do usuário.
  // Truncar aqui faz a IA perder o contexto (ex.: "bola de fogo caindo na lua" virava só "bola...").
  const hasSeparators = /[\n,;|]/.test(compact);
  if (!hasSeparators) {
    return compact.slice(0, 600);
  }

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
    // Limite generoso por segmento para não cortar frases descritivas
    .map((segment) => segment.slice(0, 240));

  if (segments.length > 0) {
    return segments.slice(0, 8).join(', ');
  }

  return compact.slice(0, 600);
}

function aiServiceError(status: number, operation: "imagem" | "texto"): Error {
  if (status === 402) {
    return new Error(
      "O saldo disponível para o serviço de IA acabou. Tente novamente mais tarde ou fale com o suporte.",
    );
  }
  if (status === 429) {
    return new Error(
      "A IA atingiu um limite temporário de solicitações. Aguarde alguns instantes e tente novamente.",
    );
  }
  if (status >= 500) {
    return new Error(
      `O modelo de ${operation === "imagem" ? "imagem" : "texto"} não respondeu agora. Tente novamente em alguns minutos.`,
    );
  }
  return new Error(
    `Não consegui gerar ${operation === "imagem" ? "a imagem" : "os textos"} agora. Revise o pedido e tente novamente.`,
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPromptFragments(sourceInput: string): string[] {
  const compact = sourceInput.replace(/\s+/g, ' ').trim();
  if (!compact) return [];

  const fragments = compact
    .split(/[\n,;|]+/)
    .map((segment) =>
      segment
        .replace(/^[-–•\d.()\s]+/, '')
        .replace(/\betc\.?$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((segment) => segment.length >= 16);

  return Array.from(new Set([compact, ...fragments])).sort((a, b) => b.length - a.length);
}

function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  const patterns = [
    /^(contexto|prompt|descrição|descricao|brief|objetivo|importante|atenção|atencao|observação|observacao|formato)\s*:?\s*$/i,
    /^analise esta imagem\b/i,
    /^crie posts?\b/i,
    /^gere \d+\s+variações\b/i,
    /^(instagram|facebook|story(?: instagram)?|whatsapp)\s*\(\d+\s+variações?\)\s*:?\s*$/i,
    /^-?\s*opção\s*[abc]\b/i,
    /^-?\s*opcao\s*[abc]\b/i,
    /^retorne apenas\b/i,
    /^responda somente\b/i,
    /^nunca inclua\b/i,
    /^todos os textos devem\b/i,
    /^use emojis\b/i,
    /^mantenha o tom\b/i,
    /^sempre termine com\b/i,
    /^sempre inclua\b/i,
    /^json válido\b/i,
    /^json valido\b/i,
    /^max\s+\d+/i,
  ];

  const normalized = trimmed.toLowerCase();

  return (
    patterns.some((pattern) => pattern.test(trimmed)) ||
    normalized.includes('contexto resumido') ||
    normalized.includes('idioma obrigatório') ||
    normalized.includes('idioma obrigatorio') ||
    normalized.includes('schema json')
  );
}

function sanitizePromptLeakage(text: string, sourceInput: string, removeSourceLiteral = false): string {
  let cleaned = text
    .replace(/^(Aqui está|Segue|Claro|Certo|Ok|Entendido|Com certeza)[^\n]*\n*/i, '')
    .replace(/```json\s*/gi, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```\s*/g, '')
    .replace(/(?:^|\n)\s*(?:Contexto|Prompt|Descrição|Descricao|Brief)\s*:\s*/gim, '\n')
    .replace(/Analise esta imagem e crie posts? promocionais? basead[oa]s? neste contexto resumido:\s*["“”]?/gi, '')
    .replace(/Analise esta imagem[^\n]*contexto[^\n]*:?\s*/gi, '')
    .replace(/Crie posts? promocionais? para o seguinte produto:\s*/gi, '')
    .replace(/basead[oa]s? neste contexto resumido\s*:?\s*/gi, '')
    .replace(/IDIOMA OBRIGATÓRIO:[^\n]*/gi, '')
    .replace(/IDIOMA OBRIGATORIO:[^\n]*/gi, '')
    .replace(/Retorne APENAS[^\n]*/gi, '')
    .replace(/Responda SOMENTE[^\n]*/gi, '')
    .replace(/\bNUNCA inclua[^\n]*/gi, '')
    .replace(/\bTODOS os textos devem[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (removeSourceLiteral) {
    for (const fragment of buildPromptFragments(sourceInput)) {
      cleaned = cleaned.replace(new RegExp(escapeRegExp(fragment), 'gi'), '');
    }
  }

  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !isInstructionLine(line))
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[\s,:;\-"“”]+/, '')
    .replace(/[\s"“”]+$/, '')
    .trim();

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

async function authenticatedUserId(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return null;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error) return null;
  return data?.user?.id ?? null;
}

async function saveSiteLogoForTenant(
  supabaseAdmin: any,
  userId: string,
  dataUrl: string,
): Promise<boolean> {
  const decoded = dataUrlToImageBytes(dataUrl);
  if (!decoded || decoded.bytes.length > 5 * 1024 * 1024) return false;
  const processed = await trimLogoImage(decoded.bytes, decoded.mime);
  const extension = processed.mime === "image/jpeg"
    ? "jpg"
    : processed.mime === "image/svg+xml"
    ? "svg"
    : "png";
  const storagePath = `${userId}/ia-marketing/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const { error } = await supabaseAdmin.storage.from("tenant-logos").upload(
    storagePath,
    processed.bytes,
    { contentType: processed.mime, upsert: false },
  );
  if (error) throw new Error(`Não consegui salvar a logo: ${error.message}`);
  return await setTenantLogo(supabaseAdmin, userId, {
    storagePath,
    fileName: `logo-site.${extension}`,
    mimeType: processed.mime,
  });
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      url,
      images = [],
      logo = null,
      source = 'generic',
      action,
      site_url: actionSiteUrl,
      logo_data_url: actionLogoDataUrl,
      use_saved_logo = false,
      brand_site_url = null,
    } = payload;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.");
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userId = await authenticatedUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente.");

    if (action === "brand_assets") {
      const assets = await loadTenantBrandAssets(supabaseAdmin, userId);
      return new Response(JSON.stringify({
        success: true,
        has_logo: Boolean(assets.logoDataUrl),
        logo_preview: assets.logoDataUrl,
        colors: assets.colors,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (action === "preview_site_identity") {
      const identity = await fetchBrandSiteIdentity(String(actionSiteUrl || ""));
      return new Response(JSON.stringify({ success: true, identity }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action === "save_site_logo") {
      const saved = await saveSiteLogoForTenant(
        supabaseAdmin,
        userId,
        String(actionLogoDataUrl || ""),
      );
      if (!saved) throw new Error("A imagem encontrada não pôde ser salva como logo.");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 Analisando:', url, '| Imagens referência:', images.length, '| Logo:', logo ? 'SIM' : 'NÃO', '| Source:', source);

    if (!url) {
      throw new Error('Texto ou URL não fornecido');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error("[analisar-produto] credencial do serviço de IA ausente");
      throw new Error('O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.');
    }

    let finalImages = images;
    let generatedImage: string | null = null;
    let logoAppliedServerSide = false;
    let brandApplicationMode = "none";
    let siteIdentity: BrandSiteIdentity | null = null;
    let logoDataUrl: string | null = typeof logo === "string" ? logo : null;
    let brandColors: string[] = [];
    const tenantAssets = await loadTenantBrandAssets(supabaseAdmin, userId, {
      includeLogo: Boolean(use_saved_logo),
    });
    const brandName = tenantAssets.brandName;
    if (use_saved_logo && userId) {
      logoDataUrl = tenantAssets.logoDataUrl;
      brandColors = tenantAssets.colors;
    } else if (brand_site_url) {
      siteIdentity = await fetchBrandSiteIdentity(String(brand_site_url));
      brandColors = siteIdentity.colors;
    }
    if (!brandColors.length && logoDataUrl) {
      brandColors = await colorsFromLogoDataUrl(logoDataUrl);
    }

    // Verificar se é uma URL válida ou apenas um prompt de texto
    const isUrl = url.match(/^https?:\/\//i);
    const applyLogoOverlay = false;
    
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

    // SEMPRE gera imagem quando não é URL (com ou sem logo), usando o mesmo
    // motor server-side do agente do WhatsApp.
    if (!isUrl) {
      const result = await generateMarketingImage({
        prompt: String(url),
        references: images,
        logoDataUrl,
        brandColors,
        brandName,
        apiKey: LOVABLE_API_KEY,
      });
      logoAppliedServerSide = result.logoApplied;
      brandApplicationMode = result.brandApplicationMode;
      console.log(
        "🎨 Imagem gerada pelo motor compartilhado:",
        result.mode,
        "| modelo:",
        result.model,
        "| marca aplicada:",
        result.logoApplied,
      );
      const imageFormat = imageUploadMetadata(result.bytes, result.mimeType);
      if (!imageFormat) throw new Error("A imagem gerada retornou bytes inválidos.");
      const fileName = `ia-marketing/${Date.now()}-${Math.random().toString(36).substring(7)}.${imageFormat.extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("produtos")
        .upload(fileName, result.bytes, { contentType: imageFormat.mime, upsert: true });
      if (uploadError) throw new Error(`Não consegui salvar a imagem gerada: ${uploadError.message}`);
      const { data: publicUrlData } = supabaseAdmin.storage.from("produtos").getPublicUrl(fileName);
      if (!publicUrlData?.publicUrl) throw new Error("Não consegui obter a URL da imagem gerada.");
      generatedImage = publicUrlData.publicUrl;
      finalImages = [generatedImage];
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
- NUNCA copie literalmente o contexto resumido nem qualquer instrução do prompt

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
          content: `Você é um especialista em marketing digital e branding. Analise imagens e crie posts promocionais criativos EXCLUSIVAMENTE em ${detectedLanguage}. Nunca repita o prompt, o contexto resumido, títulos de instrução, opções, schema JSON ou qualquer trecho literal enviado pelo usuário.` 
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
        throw aiServiceError(response.status, "texto");
      }

      const data = await response.json();
      const texto = data.choices?.[0]?.message?.content || '';
      
      console.log('Resposta da Lovable AI:', texto);

      const posts = sanitizePostPayload(
        extractJsonFromResponse(texto) as Record<string, Record<string, string>>,
        promptContext,
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
          generatedImage: generatedImage,
          applyLogoOverlay,
          brandIdentity: {
            colors: brandColors,
            logoApplied: logoAppliedServerSide,
            applicationMode: brandApplicationMode,
            message: brandApplicationMode === "in_scene_verified"
                || brandApplicationMode === "in_scene_retry_verified"
              ? "Apliquei sua logo na cena."
              : logoAppliedServerSide
              ? "Apliquei sua logo sobre a imagem."
              : null,
            siteLogo: siteIdentity?.logo_data_url ?? null,
          },
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
- NUNCA copie literalmente instruções internas nem qualquer trecho do prompt na resposta final

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
                { role: 'system', content: `Você é um especialista em marketing digital de e-commerce e afiliados. Gere posts promocionais criativos e persuasivos EXCLUSIVAMENTE em ${detectedLanguage}. Nunca repita o prompt, rótulos de instrução, opções, schema JSON ou qualquer trecho literal enviado pelo usuário.` },
                { role: 'user', content: promptEnriquecido }
              ]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro na Lovable AI:', response.status, errorText);
          throw aiServiceError(response.status, "texto");
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
- NUNCA copie literalmente instruções internas nem qualquer trecho do prompt na resposta final

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
            { role: 'system', content: `Você é um especialista em marketing digital. Gere posts promocionais criativos EXCLUSIVAMENTE em ${detectedLanguage}. Nunca repita o prompt, rótulos de instrução, opções, schema JSON ou qualquer trecho literal enviado pelo usuário.` },
            { role: 'user', content: prompt }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Lovable AI:', response.status, errorText);
      throw aiServiceError(response.status, "texto");
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
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: message,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: message === "Sua sessão expirou. Entre novamente." ? 401 : 500,
      }
    );
  }
});
