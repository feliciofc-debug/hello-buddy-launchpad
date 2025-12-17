// ============================================
// EDGE FUNCTION: Analisar Site com IA
// Firecrawl + Lovable AI (Gemini)
// Com extração REAL de logo e conteúdo
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
    // PASSO 1: Scraping COMPLETO com Firecrawl
    // ============================================
    console.log('🔍 Iniciando scraping COMPLETO com Firecrawl...');
    
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'screenshot', 'links'],
        onlyMainContent: false, // Pegar TODO o conteúdo
        waitFor: 3000, // Esperar 3s para JavaScript carregar
        timeout: 30000,
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

    // Extrair dados do scraping
    const siteData = firecrawlData.data || firecrawlData;
    const markdown = siteData.markdown || '';
    const html = siteData.html || siteData.rawHtml || '';
    const screenshot = siteData.screenshot || null;
    const metadata = siteData.metadata || {};
    const links = siteData.links || [];

    console.log('📄 Metadata extraída:', JSON.stringify(metadata, null, 2));
    console.log('📝 Markdown length:', markdown.length);
    console.log('🔗 Links encontrados:', links.length);

    // ============================================
    // EXTRAÇÃO INTELIGENTE DE LOGO
    // ============================================
    let logoUrl: string | null = null;
    const urlObj = new URL(formattedUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

    // 1. Procurar no HTML por tags de logo
    if (html) {
      const logoPatterns = [
        // Meta tags
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
        // Link tags
        /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/gi,
        /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/gi,
        /<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["']/gi,
        // Img tags com class/id logo
        /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi,
        /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo[^"']*["']/gi,
        // Img tags com alt logo
        /<img[^>]+alt=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi,
        /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*logo[^"']*["']/gi,
        // Imagens no header
        /<header[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi,
        // Qualquer img com 'logo' na src
        /<img[^>]+src=["']([^"']*logo[^"']+)["']/gi,
        /<img[^>]+src=["']([^"']*brand[^"']+)["']/gi,
      ];

      for (const pattern of logoPatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const match of matches) {
          if (match[1] && !match[1].includes('data:') && !match[1].includes('placeholder')) {
            let foundLogo = match[1];
            // Converter URLs relativas em absolutas
            if (foundLogo.startsWith('/')) {
              foundLogo = baseUrl + foundLogo;
            } else if (!foundLogo.startsWith('http')) {
              foundLogo = baseUrl + '/' + foundLogo;
            }
            logoUrl = foundLogo;
            console.log('✅ Logo encontrada via HTML pattern:', logoUrl);
            break;
          }
        }
        if (logoUrl) break;
      }
    }

    // 2. Procurar nos links extraídos
    if (!logoUrl && links.length > 0) {
      const logoLink = links.find((link: string) => 
        link && (
          link.toLowerCase().includes('logo') ||
          link.toLowerCase().includes('brand') ||
          link.match(/\.(png|jpg|jpeg|svg|webp)$/i)
        )
      );
      if (logoLink) {
        logoUrl = logoLink.startsWith('http') ? logoLink : baseUrl + logoLink;
        console.log('✅ Logo encontrada via links:', logoUrl);
      }
    }

    // 3. Open Graph / Twitter Image (geralmente a imagem principal)
    if (!logoUrl && metadata?.ogImage) {
      logoUrl = metadata.ogImage;
      console.log('✅ Logo encontrada via ogImage:', logoUrl);
    }

    // 4. Favicon como último recurso (mas de alta resolução)
    if (!logoUrl && metadata?.favicon) {
      logoUrl = metadata.favicon.startsWith('http') ? metadata.favicon : baseUrl + metadata.favicon;
      console.log('⚠️ Usando favicon como logo:', logoUrl);
    }

    // 5. Tentar URLs comuns de logo
    if (!logoUrl) {
      const commonLogoPaths = [
        '/logo.png', '/logo.svg', '/logo.jpg', '/logo.webp',
        '/images/logo.png', '/images/logo.svg',
        '/img/logo.png', '/img/logo.svg',
        '/assets/logo.png', '/assets/images/logo.png',
        '/static/logo.png', '/static/images/logo.png',
        '/wp-content/uploads/logo.png',
      ];
      
      for (const path of commonLogoPaths) {
        try {
          const testUrl = baseUrl + path;
          const testResponse = await fetch(testUrl, { method: 'HEAD' });
          if (testResponse.ok && testResponse.headers.get('content-type')?.startsWith('image/')) {
            logoUrl = testUrl;
            console.log('✅ Logo encontrada via teste de URL:', logoUrl);
            break;
          }
        } catch {
          // Continuar tentando
        }
      }
    }

    console.log('🖼️ Logo final:', logoUrl || 'Não encontrada');

    // ============================================
    // EXTRAÇÃO DE CORES DO HTML/CSS
    // ============================================
    let coresPrincipais: string[] = [];

    if (html) {
      // Procurar cores em estilos inline e CSS
      const colorPatterns = [
        // Hex colors
        /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g,
        // RGB colors
        /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
      ];

      const foundColors = new Set<string>();
      
      for (const pattern of colorPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[0].startsWith('#')) {
            const color = match[0].toUpperCase();
            // Ignorar cores muito comuns/genéricas
            if (!['#FFFFFF', '#FFF', '#000000', '#000', '#333333', '#666666', '#999999', '#CCCCCC'].includes(color)) {
              foundColors.add(color);
            }
          }
        }
      }

      // Pegar as primeiras 5 cores únicas
      coresPrincipais = Array.from(foundColors).slice(0, 5);
      console.log('🎨 Cores encontradas no HTML:', coresPrincipais);
    }

    // Fallback se não encontrou cores
    if (coresPrincipais.length === 0) {
      coresPrincipais = ['#0066CC', '#333333', '#F5F5F5'];
      console.log('⚠️ Usando cores padrão');
    }

    // ============================================
    // PASSO 2: Análise PROFUNDA com IA (Gemini)
    // ============================================
    console.log('🤖 Gerando análise profunda com IA...');

    // Limpar e preparar conteúdo para análise
    const conteudoLimpo = markdown
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove links markdown
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove imagens markdown
      .replace(/#{1,6}\s/g, '') // Remove headers markdown
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\n{3,}/g, '\n\n') // Remove múltiplas linhas vazias
      .substring(0, 5000); // Mais conteúdo para análise

    const systemPrompt = `Você é um especialista em marketing digital e análise de marcas. 
Sua tarefa é analisar PROFUNDAMENTE o site de uma empresa e criar conteúdo de marketing ALTAMENTE personalizado.

## DADOS DO SITE ANALISADO:

**URL:** ${formattedUrl}
**Título da Página:** ${metadata.title || 'Verificar no conteúdo'}
**Descrição Meta:** ${metadata.description || 'Verificar no conteúdo'}
**Logo encontrada:** ${logoUrl ? 'Sim - ' + logoUrl : 'Não encontrada'}
**Cores detectadas:** ${coresPrincipais.join(', ')}

## CONTEÚDO EXTRAÍDO DO SITE:
${conteudoLimpo || 'Conteúdo não disponível - analisar pela URL e nome do domínio'}

## SUA MISSÃO:

1. **IDENTIFIQUE O NEGÓCIO**: Analise o conteúdo e determine EXATAMENTE o que a empresa faz, seus produtos/serviços, público-alvo
2. **CAPTURE A ESSÊNCIA**: Entenda o tom, valores e personalidade da marca
3. **USE AS CORES**: As cores ${coresPrincipais.join(', ')} são da marca - use-as nas sugestões
4. **CRIE CONTEÚDO PERSONALIZADO**: Execute a tarefa do usuário de forma que pareça ter sido criado pelo time de marketing interno da empresa

## TAREFA DO USUÁRIO:
${prompt}

## RESPOSTA (JSON válido, sem markdown):
{
  "segmento": "descrição precisa do tipo de negócio e mercado de atuação",
  "produtos_servicos": "principais produtos ou serviços identificados",
  "publico_alvo": "perfil do público-alvo identificado",
  "tom_marca": "tom de comunicação (ex: profissional, descontraído, premium, técnico)",
  "valores_marca": ["valor1", "valor2", "valor3"],
  "cores_principais": ${JSON.stringify(coresPrincipais)},
  "cores_complementares": ["sugestão de cor complementar"],
  "mensagem_gerada": "O CONTEÚDO COMPLETO solicitado pelo usuário, personalizado para esta marca específica",
  "sugestao_visual": "Descrição DETALHADA para gerar uma imagem de marketing que represente esta marca específica. Incluir: estilo visual, elementos do segmento (ex: se for transportadora incluir caminhões, se for tech incluir elementos digitais), cores exatas a usar (${coresPrincipais.join(', ')}), composição, tipografia sugerida"
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
          { role: 'user', content: `Analise o site ${formattedUrl} e execute: ${prompt}` }
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

    console.log('✅ Análise da IA concluída');

    // Parse do JSON da IA
    let analise: any = {};
    try {
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
        segmento: 'Análise disponível no conteúdo',
        produtos_servicos: 'Ver análise',
        publico_alvo: 'Ver análise',
        tom_marca: 'Profissional',
        valores_marca: [],
        cores_principais: coresPrincipais,
        mensagem_gerada: aiContent,
        sugestao_visual: 'Imagem profissional de marketing'
      };
    }

    // Garantir cores
    if (!analise.cores_principais || analise.cores_principais.length === 0) {
      analise.cores_principais = coresPrincipais;
    }

    // ============================================
    // PASSO 3: Geração de Imagem Personalizada
    // ============================================
    let imagemGerada = null;

    if (analise.sugestao_visual) {
      console.log('🎨 Gerando imagem personalizada...');

      const coresHex = analise.cores_principais?.join(', ') || coresPrincipais.join(', ');
      const nomeEmpresa = metadata.title || urlObj.hostname.replace('www.', '').split('.')[0];

      try {
        const imagePrompt = `Create a professional marketing image for "${nomeEmpresa}".

COMPANY DETAILS:
- Business: ${analise.segmento || 'Professional services'}
- Industry products/services: ${analise.produtos_servicos || 'Business services'}
- Target audience: ${analise.publico_alvo || 'Business professionals'}
- Brand tone: ${analise.tom_marca || 'Professional'}

STRICT COLOR PALETTE (USE ONLY THESE):
${coresHex}

VISUAL COMPOSITION:
${analise.sugestao_visual}

REQUIREMENTS:
1. Use EXACTLY the brand colors provided: ${coresHex}
2. Include visual elements specific to the ${analise.segmento || 'business'} industry
3. Professional quality suitable for social media and marketing materials
4. Modern, clean design with clear visual hierarchy
5. 16:9 aspect ratio (1200x675px)
6. The image should look like it was created by the company's own design team
7. Do NOT include the company logo - focus on the visual concept
8. Ultra high resolution, professional marketing material`;

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
        console.log('⚠️ Erro na geração de imagem:', imageError);
      }
    }

    // ============================================
    // RESPOSTA FINAL COMPLETA
    // ============================================
    const resultado = {
      success: true,
      site: {
        url: formattedUrl,
        titulo: metadata.title || urlObj.hostname,
        descricao: metadata.description || analise.segmento || 'Site analisado com sucesso',
        screenshot: screenshot
      },
      branding: {
        logo: logoUrl,
        cores: null,
        cores_principais: coresPrincipais,
        esquema: 'light',
        fontes: []
      },
      analise: {
        ...analise,
        cores_extraidas: coresPrincipais,
      },
      imagem_gerada: imagemGerada,
      debug: {
        firecrawl_success: true,
        markdown_length: markdown.length,
        html_length: html.length,
        links_count: links.length,
        logo_encontrada: !!logoUrl,
        logo_fonte: logoUrl ? 'Extração automática' : 'Não encontrada',
        cores_encontradas: coresPrincipais.length,
        imagem_gerada: !!imagemGerada,
        metadata_title: metadata.title || null,
        metadata_description: metadata.description || null,
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
