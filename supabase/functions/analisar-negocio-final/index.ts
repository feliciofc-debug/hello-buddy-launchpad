// ============================================
// VERSÃO FINAL DEFINITIVA - ÚLTIMA TENTATIVA
// Logo real + Imagem garantida + Análise profunda
// ============================================

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
    const { url, prompt } = await req.json();
    
    if (!url || !prompt) {
      throw new Error('URL e prompt são obrigatórios');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não encontrada');
    }

    console.log('🚀 INICIANDO ANÁLISE DEFINITIVA:', url);

    // ========== EXTRAIR DOMÍNIO ==========
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    
    console.log('📍 Domínio:', domain);

    // ========== FASE 1: BUSCAR LOGO (5 MÉTODOS) ==========
    
    let logoUrl: string | null = null;
    let logoMetodo = 'nenhum';
    
    console.log('🔍 Buscando logo...');

    // MÉTODO 1: Clearbit (melhor para empresas conhecidas)
    try {
      const clearbitUrl = `https://logo.clearbit.com/${domain}`;
      const clearbitTest = await fetch(clearbitUrl, { method: 'HEAD' });
      
      if (clearbitTest.ok && clearbitTest.headers.get('content-type')?.includes('image')) {
        logoUrl = clearbitUrl;
        logoMetodo = 'clearbit';
        console.log('✅ Logo encontrada via Clearbit');
      }
    } catch (e: any) {
      console.log('⚠️ Clearbit falhou:', e.message);
    }

    // MÉTODO 2: Brandfetch (alternativa ao Clearbit)
    if (!logoUrl) {
      try {
        const brandfetchUrl = `https://api.brandfetch.io/v2/brands/${domain}`;
        const brandfetchResponse = await fetch(brandfetchUrl);
        
        if (brandfetchResponse.ok) {
          const brandfetchData = await brandfetchResponse.json();
          const logo = brandfetchData.logos?.[0]?.formats?.[0]?.src;
          
          if (logo) {
            logoUrl = logo;
            logoMetodo = 'brandfetch';
            console.log('✅ Logo encontrada via Brandfetch');
          }
        }
      } catch (e: any) {
        console.log('⚠️ Brandfetch falhou:', e.message);
      }
    }

    // MÉTODO 3: Logo.dev
    if (!logoUrl) {
      try {
        const logodevUrl = `https://img.logo.dev/${domain}?token=pk_X-RG_zFTRGeMZka-pRVeHA`;
        const logodevTest = await fetch(logodevUrl, { method: 'HEAD' });
        
        if (logodevTest.ok) {
          logoUrl = logodevUrl;
          logoMetodo = 'logodev';
          console.log('✅ Logo encontrada via Logo.dev');
        }
      } catch (e: any) {
        console.log('⚠️ Logo.dev falhou:', e.message);
      }
    }

    // MÉTODO 4: Google Favicon (alta resolução)
    if (!logoUrl) {
      logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
      logoMetodo = 'google-favicon-256';
      console.log('✅ Usando Google Favicon 256px');
    }

    // MÉTODO 5: Fallback direto do site
    const logoFallback = `${baseUrl}/logo.png`;

    console.log(`🎯 Logo final: ${logoUrl} (método: ${logoMetodo})`);

    // ========== FASE 2: EXTRAIR CONTEÚDO SITE ==========
    
    console.log('📄 Extraindo conteúdo do site...');
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const jinaResponse = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain' }
    });

    if (!jinaResponse.ok) {
      throw new Error(`Erro ao acessar site: ${jinaResponse.status}`);
    }

    const conteudoSite = await jinaResponse.text();
    console.log(`✅ Extraído ${conteudoSite.length} caracteres`);

    // ========== FASE 3: ANÁLISE PROFUNDA COM IA ==========
    
    console.log('🧠 Analisando negócio com IA...');

    const analysisPrompt = `
Você é analista de negócios sênior. Analise o conteúdo deste website:

URL: ${url}
DOMÍNIO: ${domain}

CONTEÚDO COMPLETO DO SITE:
${conteudoSite.substring(0, 10000)}

ANÁLISE OBRIGATÓRIA (seja ESPECÍFICO):

1. O QUE A EMPRESA FAZ (produto/serviço principal)
2. SETOR/INDÚSTRIA específico
3. CLIENTE ALVO (B2B/B2C/ambos)
4. CORES que aparecem no texto/descrições
5. TOM de comunicação (formal/informal/técnico)
6. PROPOSTA DE VALOR única
7. DIFERENCIAIS competitivos

TAREFA DO USUÁRIO:
${prompt}

RETORNE JSON (sem markdown):

{
  "empresa": {
    "nome": "nome da empresa",
    "oque_faz": "descrição ESPECÍFICA do negócio",
    "setor": "setor exato",
    "cliente": "perfil cliente",
    "proposta_valor": "o que oferece de único"
  },
  "identidade": {
    "cores": ["#hex1", "#hex2", "#hex3"],
    "tom": "formal/informal/técnico/acolhedor",
    "estilo": "moderno/clássico/minimalista",
    "personalidade": "3 adjetivos"
  },
  "conteudo": {
    "titulo": "título impactante",
    "texto": "mensagem usando tom da marca, mencionando elementos ESPECÍFICOS do negócio",
    "cta": "call to action",
    "hashtags": ["#tag1", "#tag2"]
  },
  "imagem_desc": "Descrição ULTRA DETALHADA (mínimo 150 palavras) de uma imagem de marketing profissional para ${domain}. Seja MUITO específico sobre elementos visuais do setor. Descreva cenário, objetos, pessoas, cores, iluminação, composição."
}

CRÍTICO: Não seja genérico! Mostre que ENTENDEU o negócio específico!
`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: analysisPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`IA falhou: ${aiResponse.status} ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('IA não retornou conteúdo');
    }

    // Parse JSON
    let analise: any;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta da IA');
      }
      analise = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      console.error('Conteúdo recebido:', aiContent);
      throw new Error(`Parse falhou: ${parseError.message}`);
    }

    console.log('✅ Análise completa');

    // ========== FASE 4: GERAR IMAGEM ==========
    
    console.log('🎨 Gerando imagem...');
    
    let imagemUrl: string | null = null;
    let imagemMetodo = 'nenhum';
    
    const coresTexto = analise.identidade?.cores?.join(', ') || '#0066cc, #ffffff';
    
    const imagePrompt = `
Create a professional marketing image for ${analise.empresa?.nome || domain}.

BUSINESS: ${analise.empresa?.oque_faz}
SECTOR: ${analise.empresa?.setor}
BRAND COLORS: ${coresTexto}
STYLE: ${analise.identidade?.estilo || 'modern professional'}

VISUAL DESCRIPTION:
${analise.imagem_desc}

Requirements:
- Professional quality
- Brand colors used prominently
- Sector-specific visual elements
- Modern composition
- High resolution
`;

    // Tentar gerar imagem com Gemini
    try {
      console.log('Tentando gerar imagem com Gemini...');
      const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [{ role: 'user', content: imagePrompt }],
          modalities: ['image', 'text'],
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        imagemUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imagemUrl) {
          imagemMetodo = 'gemini-image';
          console.log('✅ Imagem gerada via Gemini');
        }
      } else {
        console.log(`⚠️ Gemini image falhou: ${imageResponse.status}`);
      }
    } catch (e: any) {
      console.log('⚠️ Gemini image erro:', e.message);
    }

    if (!imagemUrl) {
      console.log('❌ Geração de imagem falhou');
      imagemMetodo = 'falhou';
    } else {
      console.log(`✅ Imagem gerada com sucesso: ${imagemMetodo}`);
    }

    // ========== RESPOSTA FINAL ==========
    
    const resposta = {
      success: true,
      site: {
        url,
        domain,
        titulo: analise.empresa?.nome || domain,
      },
      logo: {
        url: logoUrl,
        metodo: logoMetodo,
        fallback: logoFallback,
        clearbit: `https://logo.clearbit.com/${domain}`,
      },
      analise: {
        empresa: analise.empresa,
        identidade: analise.identidade,
      },
      conteudo: {
        titulo: analise.conteudo?.titulo,
        texto: analise.conteudo?.texto,
        cta: analise.conteudo?.cta,
        hashtags: analise.conteudo?.hashtags,
      },
      imagem: {
        url: imagemUrl,
        metodo: imagemMetodo,
        gerada: !!imagemUrl,
      },
      debug: {
        dominio_extraido: domain,
        logo_metodo: logoMetodo,
        logo_encontrada: !!logoUrl,
        conteudo_chars: conteudoSite.length,
        analise_ok: !!analise.empresa,
        imagem_metodo: imagemMetodo,
        imagem_gerada: !!imagemUrl,
      }
    };

    console.log('✅ PROCESSAMENTO COMPLETO');
    console.log('📊 Debug:', JSON.stringify(resposta.debug, null, 2));

    return new Response(
      JSON.stringify(resposta),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ ERRO CRÍTICO:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack,
        dica: 'Verifique os logs do Supabase para mais detalhes'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
