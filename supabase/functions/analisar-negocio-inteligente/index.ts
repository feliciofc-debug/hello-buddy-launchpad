// ============================================
// Edge Function: analisar-negocio-inteligente
// ANÁLISE PROFUNDA E CONTEXTUALIZADA
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
      return new Response(
        JSON.stringify({ success: false, error: 'URL e prompt obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    console.log('🔍 Iniciando análise profunda de:', url);

    // ========== FASE 1: EXTRAÇÃO DE CONTEÚDO COMPLETO ==========
    
    const jinaUrl = `https://r.jina.ai/${url}`;
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-With-Generated-Alt': 'true'
      }
    });

    if (!jinaResponse.ok) {
      throw new Error(`Erro ao acessar site: ${jinaResponse.status}`);
    }

    const conteudoCompleto = await jinaResponse.text();
    console.log(`✅ Extraído ${conteudoCompleto.length} caracteres`);

    // ========== FASE 2: ANÁLISE PROFUNDA DO NEGÓCIO ==========
    
    const analysisPrompt = `
Você é um analista de negócios experiente. Vai receber o conteúdo COMPLETO de um website e precisa fazer uma análise PROFUNDA e INTELIGENTE.

==========================================
WEBSITE: ${url}
==========================================

CONTEÚDO COMPLETO DO SITE:
${conteudoCompleto.substring(0, 15000)}

[... continua mais ${Math.max(0, conteudoCompleto.length - 15000)} caracteres]

==========================================
ANÁLISE OBRIGATÓRIA:
==========================================

Leia TODO o conteúdo acima com ATENÇÃO e responda:

1. **NEGÓCIO PRINCIPAL:**
   - O que esta empresa FAZ exatamente?
   - Qual o produto/serviço principal?
   - Quem são os clientes? (B2B? B2C? Ambos?)
   
2. **MERCADO E POSICIONAMENTO:**
   - Qual setor/indústria específica?
   - Qual o posicionamento? (Premium? Popular? Corporativo?)
   - Qual a proposta de valor única?
   
3. **IDENTIDADE VISUAL:**
   - Quais cores aparecem com frequência?
   - Qual o tom das imagens descritas?
   - É moderno/tradicional/tech/artesanal?
   
4. **TOM DE COMUNICAÇÃO:**
   - Como a empresa se comunica? (Formal? Descontraído? Técnico?)
   - Quais palavras-chave mais usam?
   - Qual a personalidade da marca?
   
5. **CONTEXTO DO BUSINESS:**
   - Qual a história/trajetória da empresa?
   - Quais os diferenciais competitivos?
   - Qual a missão/valores perceptíveis?

==========================================
TAREFA DO CLIENTE:
==========================================

${prompt}

==========================================
IMPORTANTE:
==========================================

Baseando-se na análise PROFUNDA acima, execute a tarefa do cliente de forma CONTEXTUALIZADA e INTELIGENTE.

- Use linguagem e tom condizentes com a marca
- Mencione elementos específicos do negócio
- Não seja genérico
- Mostre que ENTENDEU o negócio

Retorne JSON (sem markdown):

{
  "analise_negocio": {
    "oque_faz": "descrição clara do negócio",
    "setor": "setor específico da indústria",
    "cliente_alvo": "perfil do cliente",
    "posicionamento": "como se posiciona no mercado",
    "proposta_valor": "o que oferece de único",
    "historia": "resumo da trajetória/contexto",
    "diferenciais": ["diferencial 1", "diferencial 2", "diferencial 3"]
  },
  "identidade_marca": {
    "cores_identificadas": ["#hex1", "#hex2", "#hex3"],
    "estilo_visual": "moderno/clássico/minimalista/etc",
    "tom_comunicacao": "formal/informal/técnico/acolhedor/etc",
    "palavras_chave": ["palavra1", "palavra2", "palavra3"],
    "personalidade": "3 adjetivos que definem a marca"
  },
  "conteudo_gerado": {
    "titulo": "título chamativo e contextualizado",
    "mensagem_principal": "a mensagem solicitada, usando o tom da marca e mencionando elementos específicos do negócio",
    "call_to_action": "CTA adequado ao negócio",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
  },
  "briefing_visual": {
    "conceito": "conceito visual para a imagem",
    "elementos_obrigatorios": ["elemento 1 específico do negócio", "elemento 2", "elemento 3"],
    "paleta_cores": ["#cor1", "#cor2", "#cor3"],
    "estilo_fotografia": "descrição do estilo visual",
    "composicao": "como os elementos devem estar organizados",
    "atmosfera": "que sensação deve transmitir"
  }
}

CRÍTICO: Seja ESPECÍFICO! Não use termos genéricos! Mostre que entendeu o negócio!
`;

    console.log('🧠 Solicitando análise profunda...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`IA falhou: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    console.log('✅ Análise profunda concluída');

    // Parse JSON
    let analise;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta');
      }
      analise = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Erro parse:', parseError);
      throw new Error('IA não retornou análise válida');
    }

    // Validar estrutura
    if (!analise.analise_negocio || !analise.conteudo_gerado || !analise.briefing_visual) {
      throw new Error('Análise incompleta - faltam seções obrigatórias');
    }

    console.log('✅ Análise validada');

    // ========== FASE 3: GERAÇÃO DE IMAGEM CONTEXTUALIZADA ==========
    
    const briefing = analise.briefing_visual;
    const negocio = analise.analise_negocio;
    const cores = briefing.paleta_cores?.join(', ') || '#333, #fff';
    
    const imagePrompt = `
Você é um designer gráfico profissional especializado em marketing.

==========================================
BRIEFING DO CLIENTE:
==========================================

EMPRESA: ${negocio.oque_faz}
SETOR: ${negocio.setor}
POSICIONAMENTO: ${negocio.posicionamento}

IDENTIDADE DA MARCA:
- Tom: ${analise.identidade_marca.tom_comunicacao}
- Estilo: ${analise.identidade_marca.estilo_visual}
- Personalidade: ${analise.identidade_marca.personalidade}

==========================================
BRIEFING VISUAL OBRIGATÓRIO:
==========================================

CONCEITO: ${briefing.conceito}

PALETA DE CORES (USE EXATAMENTE ESTAS):
${cores}

ELEMENTOS OBRIGATÓRIOS NA COMPOSIÇÃO:
${briefing.elementos_obrigatorios?.map((el: string, i: number) => `${i+1}. ${el}`).join('\n')}

ESTILO FOTOGRÁFICO:
${briefing.estilo_fotografia}

COMPOSIÇÃO:
${briefing.composicao}

ATMOSFERA DESEJADA:
${briefing.atmosfera}

==========================================
CONTEÚDO TEXTUAL:
==========================================

TÍTULO: ${analise.conteudo_gerado.titulo}

MENSAGEM PRINCIPAL:
${analise.conteudo_gerado.mensagem_principal}

==========================================
ESPECIFICAÇÕES TÉCNICAS:
==========================================

- Formato: 1200x630px (paisagem, redes sociais)
- Resolução: Alta qualidade (mínimo 150 DPI)
- Texto: Legível, hierarquizado, com contraste adequado
- Composição: Regra dos terços, ponto focal definido
- Elementos: Fotografia + texto + elementos gráficos

==========================================
REQUISITOS CRÍTICOS:
==========================================

1. A imagem DEVE refletir ESPECIFICAMENTE o negócio ${negocio.setor}
2. TODOS os elementos obrigatórios devem estar presentes
3. Use EXATAMENTE a paleta de cores fornecida
4. O estilo visual deve corresponder a: ${analise.identidade_marca.estilo_visual}
5. A atmosfera deve transmitir: ${briefing.atmosfera}
6. Não use elementos genéricos ou stock photos clichê
7. A imagem deve fazer sentido APENAS para este negócio específico

==========================================
CONTEXTO DO NEGÓCIO (para inspiração):
==========================================

${negocio.proposta_valor}

Diferenciais:
${negocio.diferenciais?.map((d: string, i: number) => `${i+1}. ${d}`).join('\n')}

==========================================

Crie uma imagem PROFISSIONAL, CONTEXTUALIZADA e IMPACTANTE!

NÃO seja genérico! A imagem deve gritar "${negocio.setor}" para quem olhar!
`;

    console.log('🎨 Gerando imagem contextualizada...');

    let imagemGerada = null;
    
    try {
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
        imagemGerada = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (imagemGerada) {
          console.log('✅ Imagem contextualizada gerada!');
        }
      }
    } catch (imgError: any) {
      console.log('⚠️ Erro na imagem:', imgError?.message || imgError);
    }

    // ========== EXTRAIR LOGO (Clearbit) ==========
    
    const domain = new URL(url).hostname.replace('www.', '');
    const logoUrl = `https://logo.clearbit.com/${domain}`;

    // ========== RESPOSTA COMPLETA ==========
    
    return new Response(
      JSON.stringify({
        success: true,
        site: {
          url,
          titulo: negocio.oque_faz,
          descricao: negocio.proposta_valor,
        },
        analise_completa: {
          negocio: analise.analise_negocio,
          identidade: analise.identidade_marca,
          conteudo: analise.conteudo_gerado,
          briefing: analise.briefing_visual,
        },
        branding: {
          logo: logoUrl,
          cores_principais: briefing.paleta_cores || [],
          estilo: analise.identidade_marca.estilo_visual,
          tom: analise.identidade_marca.tom_comunicacao,
        },
        resultado_final: {
          titulo: analise.conteudo_gerado.titulo,
          mensagem: analise.conteudo_gerado.mensagem_principal,
          cta: analise.conteudo_gerado.call_to_action,
          hashtags: analise.conteudo_gerado.hashtags,
          imagem: imagemGerada,
        },
        debug: {
          caracteres_analisados: conteudoCompleto.length,
          analise_completa: true,
          contexto_negocio: true,
          briefing_visual_gerado: true,
          imagem_contextualizada: !!imagemGerada,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ ERRO:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || String(error),
        dica: 'Verifique se a URL está acessível'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
