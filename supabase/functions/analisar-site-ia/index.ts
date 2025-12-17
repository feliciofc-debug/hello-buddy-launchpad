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
        // Inclui branding para pegar logo/cores oficiais quando disponível
        formats: ['branding', 'markdown', 'html', 'screenshot', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
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

    // Extrair dados do scraping (Firecrawl v1 pode vir em data.*)
    const siteData = firecrawlData.data || firecrawlData;
    const branding = siteData.branding || {};
    const markdown = siteData.markdown || '';
    const html = siteData.html || siteData.rawHtml || '';
    const screenshot = siteData.screenshot || null;
    const metadata = siteData.metadata || {};
    const links = siteData.links || [];

    // Normaliza screenshot (Firecrawl normalmente retorna base64 puro)
    const screenshotUrl =
      typeof screenshot === 'string'
        ? (screenshot.startsWith('data:') || screenshot.startsWith('http')
            ? screenshot
            : `data:image/png;base64,${screenshot}`)
        : null;

    console.log('📝 Markdown length:', markdown.length);
    console.log('🌐 HTML length:', html.length);
    console.log('🖼️ Screenshot:', screenshotUrl ? 'sim' : 'não');

    // =============================
    // FALLBACK: se Firecrawl vier "vazio", buscar HTML direto
    // (alguns sites bloqueiam o renderer, mas liberam HTML normal)
    // =============================
    let finalHtml = html;
    let finalMarkdown = markdown;
    let finalMetadata: any = metadata;

    const firecrawlSeemsEmpty =
      (!finalMarkdown || finalMarkdown.length < 50) &&
      (!finalHtml || finalHtml.length < 200) &&
      !screenshotUrl;

    if (firecrawlSeemsEmpty) {
      console.log('⚠️ Firecrawl retornou conteúdo vazio. Tentando fetch direto do HTML...');
      try {
        const directResp = await fetch(formattedUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          },
        });

        const directHtml = await directResp.text();
        if (directResp.ok && directHtml && directHtml.length > 500) {
          finalHtml = directHtml;

          const titleMatch = directHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
          const descMatch = directHtml.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
          );
          const ogImageMatch = directHtml.match(
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i
          );

          finalMetadata = {
            ...finalMetadata,
            title: finalMetadata?.title || titleMatch?.[1]?.trim() || null,
            description: finalMetadata?.description || descMatch?.[1]?.trim() || null,
            ogImage: finalMetadata?.ogImage || ogImageMatch?.[1]?.trim() || null,
          };

          console.log('✅ Fetch direto ok. Title:', finalMetadata?.title || 'N/A');
        } else {
          console.log('⚠️ Fetch direto não trouxe HTML útil:', directResp.status);
        }
      } catch (e) {
        console.log('⚠️ Falha no fetch direto do HTML:', e);
    }
    }

    // =============================
    // FALLBACK EXTRA: Jina Reader (quando Firecrawl + fetch direto falham)
    // =============================
    const stillEmpty =
      (!finalMarkdown || finalMarkdown.length < 50) &&
      (!finalHtml || finalHtml.length < 200);

    if (stillEmpty) {
      console.log('⚠️ Conteúdo ainda vazio. Tentando Jina Reader...');
      try {
        const jinaUrl = `https://r.jina.ai/${formattedUrl}`;
        const jinaResp = await fetch(jinaUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          },
        });

        const jinaText = await jinaResp.text();
        if (jinaResp.ok && jinaText && jinaText.length > 500) {
          finalMarkdown = jinaText;
          console.log('✅ Jina Reader OK. Length:', finalMarkdown.length);
        } else {
          console.log('⚠️ Jina Reader não trouxe conteúdo útil:', jinaResp.status);
        }
      } catch (e) {
        console.log('⚠️ Falha no Jina Reader:', e);
      }
    }

    // =============================
    // VALIDAÇÃO: Site acessível?
    // =============================
    const hasContent = 
      (finalMarkdown && finalMarkdown.length > 100) ||
      (finalHtml && finalHtml.length > 500) ||
      (finalMetadata?.title && finalMetadata?.title.length > 3);

    if (!hasContent) {
      console.error('❌ Site inacessível ou sem conteúdo extraível');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Não foi possível acessar o site "${formattedUrl}". Verifique se a URL está correta e o site está no ar.`,
          siteInacessivel: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Conteúdo disponível para análise');

    // A partir daqui, usar finalHtml/finalMarkdown/finalMetadata


    // ============================================
    // EXTRAÇÃO CONFIÁVEL DE LOGO (prioriza logo real)
    // ============================================
    const urlObj = new URL(formattedUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

    const toAbsoluteUrl = (candidate: string) => {
      let u = candidate.trim();
      if (!u) return null;
      if (u.startsWith('data:')) return null; // não usar data URI como logo
      if (u.startsWith('//')) u = `${urlObj.protocol}${u}`;
      if (u.startsWith('/')) return baseUrl + u;
      if (!u.startsWith('http')) return `${baseUrl}/${u}`;
      return u;
    };

    const isLikelyLogo = (u: string) => {
      const s = u.toLowerCase();
      if (s.includes('sprite')) return false;
      if (s.includes('banner') || s.includes('hero') || s.includes('cover')) return false;
      return s.includes('logo') || s.includes('brand') || s.includes('favicon') || s.includes('icon') || s.endsWith('.svg');
    };

    const validateImageUrl = async (u: string) => {
      try {
        const resp = await fetch(u, { method: 'HEAD' });
        if (!resp.ok) return false;
        const ct = resp.headers.get('content-type') || '';
        return ct.startsWith('image/');
      } catch {
        return false;
      }
    };

    const logoCandidates: Array<{ url: string; source: string; score: number }> = [];

    // 1) Branding (Firecrawl)
    const brandingLogo =
      (branding as any)?.images?.logo ||
      (branding as any)?.images?.logoUrl ||
      (branding as any)?.logo ||
      (branding as any)?.images?.favicon;

    if (typeof brandingLogo === 'string') {
      const abs = toAbsoluteUrl(brandingLogo);
      if (abs) logoCandidates.push({ url: abs, source: 'firecrawl.branding', score: 100 });
    }


    // 2) HTML: img com class/id/alt logo (prioridade máxima)
    if (finalHtml) {
      const patterns = [
        /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi,
        /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo[^"']*["']/gi,
        /<img[^>]+alt=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi,
        /<header[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi,
      ];

      for (const pattern of patterns) {
        const matches = [...finalHtml.matchAll(pattern)];
        for (const m of matches) {
          const abs = m?.[1] ? toAbsoluteUrl(m[1]) : null;
          if (!abs) continue;
          const score = isLikelyLogo(abs) ? 95 : 70;
          logoCandidates.push({ url: abs, source: 'html.img', score });
        }
      }

      // 3) HTML: ícones (fallback)
      const iconPatterns = [
        /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/gi,
      ];
      for (const pattern of iconPatterns) {
        const matches = [...finalHtml.matchAll(pattern)];
        for (const m of matches) {
          const abs = m?.[1] ? toAbsoluteUrl(m[1]) : null;
          if (!abs) continue;
          logoCandidates.push({ url: abs, source: 'html.icon', score: 40 });
        }
      }
    }

    // 4) Metadata ogImage/twitter
    if (finalMetadata?.ogImage && typeof finalMetadata.ogImage === 'string') {
      const abs = toAbsoluteUrl(finalMetadata.ogImage);
      if (abs) logoCandidates.push({ url: abs, source: 'metadata.ogImage', score: 20 });
    }
    if (finalMetadata?.favicon && typeof finalMetadata.favicon === 'string') {
      const abs = toAbsoluteUrl(finalMetadata.favicon);
      if (abs) logoCandidates.push({ url: abs, source: 'metadata.favicon', score: 30 });
    }

    // 5) Links extraídos
    if (links?.length) {
      for (const link of links as string[]) {
        if (!link) continue;
        const abs = toAbsoluteUrl(link);
        if (!abs) continue;
        if (!abs.match(/\.(png|jpg|jpeg|svg|webp|ico)(\?.*)?$/i)) continue;
        const score = isLikelyLogo(abs) ? 50 : 10;
        logoCandidates.push({ url: abs, source: 'firecrawl.links', score });
      }
    }

    // Ordena por score e valida com HEAD
    let logoUrl: string | null = null;
    let logoFonte: string | null = null;
    const uniqueCandidates = Array.from(
      new Map(
        logoCandidates
          .filter((c) => !!c.url)
          .sort((a, b) => b.score - a.score)
          .map((c) => [c.url, c])
      ).values()
    );

    for (const c of uniqueCandidates.slice(0, 8)) {
      if (await validateImageUrl(c.url)) {
        logoUrl = c.url;
        logoFonte = c.source;
        break;
      }
    }

    if (!logoUrl) {
      // fallback 1: caminhos comuns (tenta validar)
      const commonPaths = [`${baseUrl}/logo.png`, `${baseUrl}/logo.svg`, `${baseUrl}/assets/logo.png`];
      for (const u of commonPaths) {
        if (await validateImageUrl(u)) {
          logoUrl = u;
          logoFonte = 'fallback:common-path';
          break;
        }
      }

      // fallback 2 (mais confiável): Clearbit logo por domínio
      // NÃO valida com HEAD - Clearbit é serviço confiável e retorna 404 se não tiver
      if (!logoUrl) {
        const domain = urlObj.hostname.replace('www.', '');
        logoUrl = `https://logo.clearbit.com/${domain}`;
        logoFonte = 'fallback:clearbit';
        console.log('🔷 Usando Clearbit Logo (sem validação):', logoUrl);
      }

      // fallback 3: Google Favicon (128px)
      if (!logoUrl) {
        const domain = urlObj.hostname.replace('www.', '');
        logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        logoFonte = 'fallback:google-favicon';
      }

      console.log('⚠️ Logo via fallback:', logoUrl, logoFonte);
    } else {
      console.log('✅ Logo encontrada:', logoUrl, 'via', logoFonte);
    }

    // ============================================
    // EXTRAÇÃO DE CORES (branding > HTML)
    // ============================================
    let coresPrincipais: string[] = [];

    const pushColor = (c?: string) => {
      if (!c || typeof c !== 'string') return;
      const v = c.trim();
      if (!v) return;
      if (!coresPrincipais.includes(v)) coresPrincipais.push(v);
    };

    // 1) Branding Firecrawl
    pushColor((branding as any)?.colors?.primary);
    pushColor((branding as any)?.colors?.secondary);
    pushColor((branding as any)?.colors?.accent);

    // 2) HTML (hex)
    if (coresPrincipais.length === 0 && finalHtml) {
      const found = new Set<string>();
      for (const m of finalHtml.matchAll(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g)) {
        const color = `#${m[1]}`.toUpperCase();
        if (!['#FFFFFF', '#FFF', '#000000', '#000', '#333333', '#666666', '#999999', '#CCCCCC'].includes(color)) {
          found.add(color);
        }
      }
      coresPrincipais = Array.from(found).slice(0, 5);
    }

    if (coresPrincipais.length === 0) {
      const scheme = (branding as any)?.colorScheme;
      coresPrincipais = scheme === 'dark' ? ['#1A1A1A', '#333333'] : ['#0066CC', '#FFFFFF'];
    }

    // ============================================
    // PASSO 2: Análise PROFUNDA com IA (com visão)
    // ============================================
    console.log('🤖 Gerando análise profunda com IA...');

    const conteudoLimpo = finalMarkdown
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .substring(0, 6000);

    const analysisPrompt = `Você é um especialista em marketing e branding. Analise as informações abaixo de uma empresa e execute a tarefa solicitada.

## Informações da Empresa (extraídas do site ${formattedUrl}):

**Título:** ${finalMetadata?.title || 'Não identificado'}
**Descrição:** ${finalMetadata?.description || 'Não identificada'}
**URL do site:** ${formattedUrl}

**Branding:**
- Logo URL: ${logoUrl || 'Não encontrada'}
- Cores principais: ${coresPrincipais.join(', ') || 'Não identificadas'}
- Todas as cores: ${JSON.stringify((branding as any)?.colors || {})}
- Fontes: ${JSON.stringify((branding as any)?.fonts || [])}
- Esquema de cores: ${(branding as any)?.colorScheme || 'Não identificado'}

**Conteúdo do site (primeiros 6000 caracteres):**
${conteudoLimpo || 'Não disponível'}

## Tarefa do Usuário:
${prompt}

Responda APENAS em JSON válido (sem markdown, sem crases):
{
  "segmento": "tipo de mercado identificado (ex: financeira, tecnologia, saúde)",
  "tom_marca": "descrição do tom de voz",
  "cores_principais": ${JSON.stringify(coresPrincipais)},
  "cores_complementares": ["#hex3", "#hex4"],
  "mensagem_gerada": "texto solicitado pelo usuário, altamente específico",
  "sugestao_visual": "descrição detalhada da imagem ideal"
}`;

    // Se o site vier pobre (sem title/markdown), usa screenshot para 'estudar' visualmente.
    const shouldUseVision = !finalMetadata?.title && (!conteudoLimpo || conteudoLimpo.length < 300);

    const messages: any[] = [{ role: 'system', content: analysisPrompt }];

    if (shouldUseVision && screenshotUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Analise visualmente o screenshot do site e identifique com precisão o negócio. Depois execute: ${prompt}` },
          { type: 'image_url', image_url: { url: screenshotUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: `Analise o site ${formattedUrl} e execute: ${prompt}` });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
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
      const nomeEmpresa = finalMetadata?.title || urlObj.hostname.replace('www.', '').split('.')[0];

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
            model: 'google/gemini-2.5-flash-image',
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
        titulo: finalMetadata?.title || urlObj.hostname,
        descricao: finalMetadata?.description || analise.segmento || 'Site analisado com sucesso',
        screenshot: screenshotUrl,
      },
      branding: {
        logo: logoUrl,
        cores: (branding as any)?.colors || {},
        cores_principais: coresPrincipais,
        esquema: (branding as any)?.colorScheme || 'light',
        fontes: (branding as any)?.fonts || [],
      },
      analise: {
        ...analise,
        cores_extraidas: coresPrincipais,
      },
      imagem_gerada: imagemGerada,
      debug: {
        firecrawl_success: true,
        firecrawl_seems_empty: firecrawlSeemsEmpty,
        markdown_length: finalMarkdown.length,
        html_length: finalHtml.length,
        links_count: links.length,
        logo_encontrada: !!logoUrl,
        logo_fonte: logoFonte,
        cores_encontradas: coresPrincipais.length,
        imagem_gerada: !!imagemGerada,
        metadata_title: finalMetadata?.title || null,
        metadata_description: finalMetadata?.description || null,
      },
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
