// ============================================
// EDGE FUNCTION: Analisar Site com IA
// Firecrawl + Lovable AI (Gemini)
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
        formats: ['branding', 'markdown', 'screenshot'],
        onlyMainContent: true,
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
    const branding = siteData.branding || {};
    const markdown = siteData.markdown || '';
    const screenshot = siteData.screenshot || null;
    const metadata = siteData.metadata || {};

    console.log('🎨 Branding extraído:', JSON.stringify(branding, null, 2));

    // ============================================
    // PASSO 2: Análise com IA (Gemini)
    // ============================================
    console.log('🤖 Gerando conteúdo com IA...');

    const systemPrompt = `Você é um especialista em marketing digital brasileiro. Analise as informações do site e crie conteúdo de marketing personalizado.

INFORMAÇÕES DO SITE:
- Título: ${metadata.title || 'N/A'}
- Descrição: ${metadata.description || 'N/A'}
- Conteúdo: ${markdown.substring(0, 2000)}

BRANDING DETECTADO:
- Logo: ${branding.logo || 'N/A'}
- Cores: ${JSON.stringify(branding.colors || {})}
- Esquema de cores: ${branding.colorScheme || 'N/A'}
- Fontes: ${JSON.stringify(branding.fonts || [])}

INSTRUÇÕES:
1. Analise o tipo de negócio/segmento
2. Identifique o tom de comunicação da marca
3. Extraia as cores principais
4. Crie o conteúdo solicitado pelo usuário, mantendo a identidade visual e tom da marca
5. Sugira uma descrição para uma imagem que combine com o conteúdo

Responda APENAS em JSON válido com esta estrutura:
{
  "segmento": "tipo de negócio identificado",
  "tom_marca": "tom de comunicação (ex: profissional, descontraído, premium)",
  "cores_principais": ["#cor1", "#cor2", "#cor3"],
  "mensagem_gerada": "conteúdo de marketing criado",
  "sugestao_visual": "descrição detalhada para gerar uma imagem de marketing"
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
        cores_principais: [],
        mensagem_gerada: aiContent,
        sugestao_visual: ''
      };
    }

    // ============================================
    // PASSO 3: Geração de Imagem (Opcional)
    // ============================================
    let imagemGerada = null;

    if (analise.sugestao_visual) {
      console.log('🎨 Gerando imagem com IA...');

      try {
        const imagePrompt = `Create a professional marketing image for a Brazilian company. 
Company segment: ${analise.segmento}
Brand colors: ${analise.cores_principais?.join(', ') || 'professional colors'}
Visual suggestion: ${analise.sugestao_visual}
Style: Modern, clean, professional marketing material. 16:9 aspect ratio. Ultra high resolution.`;

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
          }
        } else {
          console.log('⚠️ Falha na geração de imagem (opcional), continuando...');
        }
      } catch (imageError) {
        console.log('⚠️ Erro na geração de imagem (opcional):', imageError);
        // Continua sem imagem - não é erro crítico
      }
    }

    // ============================================
    // RESPOSTA FINAL
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
        logo: branding.logo || null,
        cores: branding.colors || null,
        esquema: branding.colorScheme || null,
        fontes: branding.fonts || []
      },
      analise: analise,
      imagem_gerada: imagemGerada
    };

    console.log('🎉 Análise completa!');

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
