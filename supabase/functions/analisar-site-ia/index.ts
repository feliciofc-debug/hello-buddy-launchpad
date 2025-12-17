// ============================================
// EDGE FUNCTION: Analisar Site com IA
// Firecrawl + Lovable AI (Gemini)
// Com extração melhorada de logo e cores
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, prompt } = await req.json();

    if (!url || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL e prompt são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado. Configure a API Key nas configurações.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable AI não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('📡 Analisando site:', formattedUrl);

    // ============================================
    // PASSO 1: Scraping com Firecrawl
    // ============================================
    console.log('🔍 Iniciando scraping com Firecrawl...');
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['branding', 'markdown', 'screenshot', 'html'],
        onlyMainContent: false, // Pegar todo conteúdo para encontrar logo
      }),
    });

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlResponse.ok) {
      console.error('❌ Erro Firecrawl:', firecrawlData);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao acessar o site. Verifique se a URL está correta.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Scraping concluído');

    // Extrair dados do scraping com fallbacks
    const siteData = firecrawlData.data || firecrawlData;
    const branding = siteData.branding || {};
    const markdown = siteData.markdown || '';
    const html = siteData.html || '';
    const screenshot = siteData.screenshot || null;
    const metadata = siteData.metadata || {};

    console.log('🎨 Branding recebido do Firecrawl:', JSON.stringify(branding, null, 2));

    // ============================================
    // EXTRAÇÃO MELHORADA DE LOGO
    // ============================================
    let logoUrl: string | null = null;

    // 1. Branding Firecrawl - images.logo
    if (branding?.images?.logo) {
      logoUrl = branding.images.logo;
      console.log('✅ Logo encontrada via branding.images.logo:', logoUrl);
    }

    // 2. Branding Firecrawl - logo direto
    if (!logoUrl && branding?.logo) {
      logoUrl = branding.logo;
      console.log('✅ Logo encontrada via branding.logo:', logoUrl);
    }

    // 3. Open Graph Image (og:image)
    if (!logoUrl && metadata?.ogImage) {
      logoUrl = metadata.ogImage;
      console.log('✅ Logo encontrada via ogImage:', logoUrl);
    }

    // 4. Favicon de alta resolução
    if (!logoUrl && metadata?.favicon) {
      logoUrl = metadata.favicon;
      console.log('✅ Logo encontrada via favicon:', logoUrl);
    }

    // 5. Extrair do Markdown/HTML
    if (!logoUrl && (markdown || html)) {
      const contentToSearch = markdown + html;
      const logoPatterns = [
        /!\[.*logo.*\]\((https?:\/\/[^\)]+)\)/gi,
        /!\[.*brand.*\]\((https?:\/\/[^\)]+)\)/gi,
        /<img[^>]+src=["'](https?:\/\/[^"']*logo[^"']*)["']/gi,
        /<img[^>]+src=["'](https?:\/\/[^"']*brand[^"']*)["']/gi,
        /<img[^>]+class=["'][^"']*logo[^"']*["'][^>]+src=["'](https?:\/\/[^"']+)["']/gi,
        /<link[^>]+rel=["']icon["'][^>]+href=["'](https?:\/\/[^"']+)["']/gi,
        /logo[^"']*["']?\s*:\s*["'](https?:\/\/[^"']+)["']/gi,
      ];
      
      for (const pattern of logoPatterns) {
        const matches = contentToSearch.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            logoUrl = match[1];
            console.log('✅ Logo encontrada via regex em HTML/Markdown:', logoUrl);
            break;
          }
        }
        if (logoUrl) break;
      }
    }

    // 6. Se ainda não achou, construir URL padrão
    if (!logoUrl) {
      try {
        const urlObj = new URL(formattedUrl);
        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        // URLs comuns de logo
        const possibleLogos = [
          `${baseUrl}/logo.png`,
          `${baseUrl}/logo.svg`,
          `${baseUrl}/images/logo.png`,
          `${baseUrl}/img/logo.png`,
          `${baseUrl}/assets/logo.png`,
          `${baseUrl}/favicon.ico`,
        ];
        logoUrl = possibleLogos[0]; // Fallback básico
        console.log('⚠️ Logo não encontrada, usando fallback:', logoUrl);
      } catch {
        console.log('⚠️ Não foi possível construir URL de logo fallback');
      }
    }

    // ============================================
    // EXTRAÇÃO MELHORADA DE CORES
    // ============================================
    let coresPrincipais: string[] = [];

    // 1. Do branding Firecrawl
    if (branding?.colors?.primary) {
      coresPrincipais.push(branding.colors.primary);
    }
    if (branding?.colors?.secondary) {
      coresPrincipais.push(branding.colors.secondary);
    }
    if (branding?.colors?.accent) {
      coresPrincipais.push(branding.colors.accent);
    }
    if (branding?.colors?.background && coresPrincipais.length < 4) {
      coresPrincipais.push(branding.colors.background);
    }

    // 2. Se não tem cores suficientes, usar cores do colorScheme
    if (coresPrincipais.length === 0) {
      if (branding?.colorScheme === 'dark') {
        coresPrincipais = ['#1a1a1a', '#333333', '#4a4a4a'];
      } else {
        coresPrincipais = ['#0066cc', '#ffffff', '#f5f5f5'];
      }
      console.log('⚠️ Cores não detectadas, usando fallback:', coresPrincipais);
    }

    console.log('✅ Cores principais extraídas:', coresPrincipais);

    // ============================================
    // PASSO 2: Análise com IA (Gemini)
    // ============================================
    console.log('🤖 Gerando conteúdo com IA...');

    const systemPrompt = `Você é um especialista em marketing e branding. Analise as informações abaixo de uma empresa e execute a tarefa solicitada.

## Informações da Empresa (extraídas do site ${formattedUrl}):

**Título:** ${metadata?.title || 'Não identificado'}
**Descrição:** ${metadata?.description || 'Não identificada'}
**URL do site:** ${formattedUrl}

**Branding:**
- Logo URL: ${logoUrl || 'Não encontrada'}
- Cores principais detectadas: ${coresPrincipais.join(', ') || 'Não identificadas'}
- Todas as cores: ${JSON.stringify(branding?.colors || {})}
- Fontes: ${JSON.stringify(branding?.fonts || [])}
- Esquema de cores: ${branding?.colorScheme || 'Não identificado'}

**Conteúdo do site (primeiros 3000 caracteres):**
${markdown?.substring(0, 3000) || 'Não disponível'}

## Tarefa do Usuário:
${prompt}

## Instruções IMPORTANTES:
1. Identifique o segmento/tipo de mercado da empresa com precisão
2. Analise o tom de voz e personalidade da marca baseado no conteúdo
3. SEMPRE use as cores principais fornecidas acima na sua análise - preserve os códigos hex exatos
4. Execute a tarefa solicitada de forma personalizada para esta empresa específica
5. Seja criativo e profissional
6. A mensagem deve ter o tom e estilo da marca

Responda APENAS em formato JSON válido (sem markdown, sem \`\`\`):
{
  "segmento": "tipo de mercado identificado (ex: caminhões, tecnologia, saúde)",
  "tom_marca": "descrição do tom de voz (ex: profissional e confiável)",
  "cores_principais": ["#hexadecimal1", "#hexadecimal2"],
  "cores_complementares": ["#hexadecimal3", "#hexadecimal4"],
  "mensagem_gerada": "a mensagem/conteúdo solicitado pelo usuário",
  "sugestao_visual": "descrição detalhada de como seria uma imagem ideal para acompanhar, incluindo elementos visuais específicos do segmento"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro AI Gateway:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gerar conteúdo com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    console.log('✅ Conteúdo gerado pela IA');

    // Parse do JSON da IA
    let analise: any = {};
    try {
      // Limpar markdown do response se houver
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/, '').replace(/```\n?$/, '');
      }
      analise = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('⚠️ Erro ao parsear resposta da IA:', parseError);
      analise = {
        segmento: 'Não identificado',
        tom_marca: 'Não identificado',
        cores_principais: coresPrincipais,
        mensagem_gerada: aiContent,
        sugestao_visual: ''
      };
    }

    // Garantir que cores_principais da análise usa as cores extraídas se IA não retornou
    if (!analise.cores_principais || analise.cores_principais.length === 0) {
      analise.cores_principais = coresPrincipais;
    }

    // ============================================
    // PASSO 3: Geração de Imagem (Melhorada)
    // ============================================
    let imagemGerada = null;

    if (analise.sugestao_visual) {
      console.log('🎨 Gerando imagem com IA...');

      // Usar cores da análise ou extraídas
      const coresHex = analise.cores_principais?.join(', ') || coresPrincipais.join(', ') || '#0066cc, #ffffff';

      try {
        const imagePrompt = `Crie uma imagem profissional de marketing para a empresa ${metadata?.title || 'empresa'}.

INFORMAÇÕES DA MARCA:
- Nome: ${metadata?.title || 'Empresa'}
- Segmento: ${analise.segmento || 'corporativo'}
- Tom: ${analise.tom_marca || 'profissional'}
- URL: ${formattedUrl}

PALETA DE CORES (USE EXATAMENTE ESTAS):
- Cores principais: ${coresHex}
- Esquema: ${branding?.colorScheme === 'dark' ? 'moderno e elegante com fundo escuro' : 'limpo e profissional com fundo claro'}

COMPOSIÇÃO DA IMAGEM:
${analise.sugestao_visual}

REQUISITOS OBRIGATÓRIOS:
1. Use APENAS as cores da marca fornecidas: ${coresHex}
2. Inclua elementos visuais do segmento ${analise.segmento}
3. Estilo profissional adequado para redes sociais
4. Texto legível e hierarquia visual clara
5. Composição equilibrada e moderna
6. Formato paisagem 16:9 (1200x675px ideal)
7. Se a marca for de caminhões/transporte, inclua veículos
8. Se for tecnologia, inclua elementos tech/digitais
9. Se for saúde, inclua elementos relacionados

A imagem deve parecer que foi feita pela equipe de design da própria empresa.
Ultra high resolution. Professional marketing material.`;

        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              { role: 'user', content: imagePrompt }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImage) {
            imagemGerada = generatedImage;
            console.log('✅ Imagem gerada com sucesso');
          } else {
            console.log('⚠️ Resposta de imagem sem URL');
          }
        } else {
          const imgError = await imageResponse.text();
          console.log('⚠️ Falha na geração de imagem:', imgError);
        }
      } catch (imageError) {
        console.log('⚠️ Erro na geração de imagem (opcional):', imageError);
        // Continua sem imagem - não é erro crítico
      }
    }

    // ============================================
    // RESPOSTA FINAL COM DEBUG INFO
    // ============================================
    const resultado = {
      success: true,
      site: {
        url: formattedUrl,
        titulo: metadata.title || 'N/A',
        descricao: metadata.description || 'N/A',
        screenshot: screenshot
      },
      branding: {
        logo: logoUrl,
        cores: branding.colors || null,
        cores_principais: coresPrincipais,
        esquema: branding.colorScheme || 'light',
        fontes: branding.fonts || []
      },
      analise: {
        ...analise,
        cores_extraidas: coresPrincipais,
      },
      imagem_gerada: imagemGerada,
      debug: {
        firecrawl_branding_recebido: !!branding && Object.keys(branding).length > 0,
        logo_encontrada: !!logoUrl,
        logo_fonte: logoUrl ? (
          branding?.images?.logo ? 'branding.images.logo' :
          branding?.logo ? 'branding.logo' :
          metadata?.ogImage ? 'ogImage' :
          metadata?.favicon ? 'favicon' :
          'regex/fallback'
        ) : null,
        cores_encontradas: coresPrincipais.length,
        imagem_gerada: !!imagemGerada,
      }
    };

    console.log('🎉 Análise completa!');
    console.log('📊 Debug:', JSON.stringify(resultado.debug, null, 2));

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
