import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════
// MAPA DE ESTADOS
// ═══════════════════════════════════════════
const ESTADOS_MAP: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal',
  'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão',
  'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
  'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco',
  'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima',
  'SC': 'Santa Catarina', 'SP': 'São Paulo', 'SE': 'Sergipe',
  'TO': 'Tocantins'
};

// ═══════════════════════════════════════════
// FUNÇÃO: BUSCAR LINKEDIN DETALHADO (COM SNIPPET)
// ═══════════════════════════════════════════
async function buscarLinkedInDetalhado(
  nome: string, 
  cidade: string,
  estado: string
): Promise<{ url: string, snippet: string } | null> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
  
  if (!SERPAPI_KEY) return null;
  
  try {
    // Query: nome + cidade + estado + linkedin
    const query = encodeURIComponent(
      `${nome} ${cidade} ${estado} site:linkedin.com/in/`
    );
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=3`;
    
    console.log(`  🔍 Buscando LinkedIn: ${nome} ${cidade} ${estado}`);
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const results = data.organic_results || [];
    
    for (const result of results) {
      const link = result.link || '';
      if (link.includes('linkedin.com/in/')) {
        return {
          url: link,
          snippet: result.snippet || result.title || '' // IMPORTANTE!
        };
      }
    }
    
    return null;
  } catch (e) {
    console.log(`  ❌ Erro busca LinkedIn:`, e);
    return null;
  }
}

// ═══════════════════════════════════════════
// FUNÇÃO: VERIFICAR LOCALIZAÇÃO POR CIDADE/ESTADO
// ═══════════════════════════════════════════
function verificarLocalizacao(
  linkedinUrl: string, 
  snippet: string,
  cidadeEsperada: string,
  estadoEsperado: string
): boolean {
  console.log(`  🔍 Verificando localização...`);
  console.log(`     Esperado: ${cidadeEsperada}, ${estadoEsperado}`);
  
  const textoCompleto = (linkedinUrl + ' ' + snippet).toLowerCase();
  
  // Verificar CIDADE primeiro (mais específico)
  if (cidadeEsperada) {
    const cidade = cidadeEsperada.toLowerCase();
    
    if (textoCompleto.includes(cidade)) {
      console.log(`     ✅ Cidade encontrada: ${cidadeEsperada}`);
      return true;
    }
    
    // Variações da cidade (acentos)
    const variacoes = [
      cidade.replace(/ã/g, 'a'),
      cidade.replace(/ô/g, 'o'),
      cidade.replace(/é/g, 'e'),
      cidade.replace(/í/g, 'i'),
      cidade.replace(/ç/g, 'c'),
      cidade.replace(/ /g, '')
    ];
    
    for (const variacao of variacoes) {
      if (textoCompleto.includes(variacao)) {
        console.log(`     ✅ Cidade (variação): ${cidadeEsperada}`);
        return true;
      }
    }
  }
  
  // Verificar ESTADO
  if (estadoEsperado) {
    const siglaEstado = estadoEsperado.toUpperCase();
    const nomeEstado = ESTADOS_MAP[siglaEstado]?.toLowerCase();
    
    if (textoCompleto.includes(siglaEstado.toLowerCase()) || 
        (nomeEstado && textoCompleto.includes(nomeEstado))) {
      console.log(`     ✅ Estado encontrado: ${estadoEsperado}`);
      return true;
    }
  }
  
  // Verificar termos que indicam exterior (descarta imediatamente)
  const termosExterior = [
    'united states', 'usa', 'new york', 'california', 'texas',
    'florida', 'los angeles', 'london', 'uk', 'europe', 'canada',
    'australia', 'germany', 'france', 'spain', 'portugal', 'miami',
    'san francisco', 'chicago', 'boston'
  ];
  
  for (const termo of termosExterior) {
    if (textoCompleto.includes(termo)) {
      console.log(`     ❌ Termo exterior detectado: ${termo}`);
      return false;
    }
  }
  
  console.log(`     ❌ Localização não confere (descartado)`);
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando busca via APIFY Google Maps Scraper...');
    
    const params = await req.json();
    console.log('Parâmetros recebidos:', params);
    
    const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY');
    
    if (!APIFY_API_KEY) {
      console.log('❌ APIFY_API_KEY não configurada');
      return new Response(
        JSON.stringify({
          success: false,
          total: 0,
          leads: [],
          message: 'Configure APIFY_API_KEY nas secrets do Supabase.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ APIFY_API_KEY configurada');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { estados = [], cidades = [], max_leads = 50 } = params;
    console.log('📊 Max leads solicitados:', max_leads);
    
    // Detectar cidade principal para validação
    let cidadePrincipal = 'Rio de Janeiro';
    if (cidades.length > 0) {
      cidadePrincipal = cidades[0];
    } else if (estados.includes('SP')) {
      cidadePrincipal = 'São Paulo';
    }
    console.log('📍 Cidade principal para validação:', cidadePrincipal);
    
    // ═══════════════════════════════════════
    // MONTAR QUERIES DE BUSCA
    // ═══════════════════════════════════════
    const searchQueries: string[] = [];

    if (cidades.some((c: string) => c.toLowerCase().includes('rio')) || estados.includes('RJ')) {
      console.log('🏙️ Buscando em TODAS as zonas do Rio de Janeiro...');
      
      // Zona Sul
      searchQueries.push(
        'corretora de imóveis Copacabana Rio de Janeiro',
        'corretora de imóveis Ipanema Rio de Janeiro',
        'imobiliária Copacabana',
        'imobiliária Ipanema'
      );
      
      // Zona Oeste
      searchQueries.push(
        'corretora de imóveis Barra da Tijuca',
        'corretora de imóveis Recreio',
        'imobiliária Barra da Tijuca'
      );
      
      // Zona Norte
      searchQueries.push(
        'corretora de imóveis Tijuca',
        'imobiliária Tijuca'
      );
      
      // Investidores
      searchQueries.push(
        'investimento imobiliário Rio de Janeiro'
      );
    } else if (cidades.length > 0) {
      for (const cidade of cidades) {
        searchQueries.push(`corretora de imóveis ${cidade}`);
        searchQueries.push(`imobiliária ${cidade}`);
      }
    } else {
      searchQueries.push(
        'corretora de imóveis Rio de Janeiro',
        'imobiliária São Paulo'
      );
    }

    console.log(`🔍 Total de queries: ${searchQueries.length}`);
    console.log('Queries:', searchQueries);

    // ═══════════════════════════════════════
    // CHAMAR APIFY GOOGLE MAPS SCRAPER
    // ═══════════════════════════════════════
    console.log('🏢 Chamando Apify Google Maps Scraper...');
    
    const actorId = 'nwua9Gu5YrADL7ZDj';
    const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
    
    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: searchQueries.slice(0, 8), // Limitar para economizar créditos
        maxCrawledPlacesPerSearch: 10,
        language: 'pt-BR',
        includeReviews: true,
        maxReviews: 20,
        reviewsSort: 'newest'
      })
    });
    
    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('❌ Erro Apify:', apifyResponse.status, errorText);
      throw new Error(`Erro Apify: ${apifyResponse.status}`);
    }
    
    const corretoras = await apifyResponse.json();
    console.log(`✅ ${corretoras.length} corretoras encontradas via Apify`);

    // ═══════════════════════════════════════
    // PROCESSAR REVIEWS
    // ═══════════════════════════════════════
    console.log('📝 Processando reviews...');
    
    const todosReviews: any[] = [];
    
    for (const corretora of corretoras) {
      if (corretora.reviews && corretora.reviews.length > 0) {
        console.log(`  📍 ${corretora.title}: ${corretora.reviews.length} reviews`);
        
        for (const review of corretora.reviews) {
          let diasAtras = 999;
          
          if (review.publishedAtDate) {
            const reviewDate = new Date(review.publishedAtDate);
            diasAtras = Math.floor((Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
          } else if (review.publishAt) {
            const texto = (review.publishAt || '').toLowerCase();
            if (texto.includes('dia')) diasAtras = 7;
            else if (texto.includes('semana')) diasAtras = 21;
            else if (texto.includes('mês') || texto.includes('mes')) diasAtras = 45;
            else diasAtras = 90;
          }
          
          if (diasAtras <= 90) {
            todosReviews.push({
              author_name: review.name || review.reviewerName || 'Anônimo',
              profile_photo_url: review.profilePhotoUrl || review.reviewerPhotoUrl,
              rating: review.stars || review.rating,
              text: review.text || review.reviewText,
              dias_atras: diasAtras,
              relative_time_description: review.publishAt || `há ${diasAtras} dias`,
              corretora_nome: corretora.title,
              corretora_endereco: corretora.address
            });
          }
        }
      }
    }
    
    console.log(`📊 ${todosReviews.length} reviews dos últimos 90 dias`);

    // ═══════════════════════════════════════
    // AGRUPAR POR AUTOR
    // ═══════════════════════════════════════
    console.log('👤 Agrupando por autor...');
    
    const autores: { [key: string]: any } = {};
    
    for (const review of todosReviews) {
      const autorNome = review.author_name;
      if (!autorNome || autorNome === 'Anônimo') continue;
      
      const autorId = autorNome.toLowerCase().replace(/\s+/g, '_');
      
      if (!autores[autorId]) {
        autores[autorId] = {
          nome: autorNome,
          foto_url: review.profile_photo_url,
          corretoras_visitadas: [],
          total_reviews: 0
        };
      }
      
      autores[autorId].corretoras_visitadas.push({
        nome: review.corretora_nome,
        endereco: review.corretora_endereco,
        review: review.text,
        rating: review.rating,
        data: review.relative_time_description,
        dias_atras: review.dias_atras
      });
      autores[autorId].total_reviews++;
    }
    
    console.log(`👥 ${Object.keys(autores).length} autores únicos`);

    // ═══════════════════════════════════════
    // CALCULAR SCORE
    // ═══════════════════════════════════════
    console.log('🎯 Calculando scores...');
    
    const leads: any[] = [];

    for (const [autorId, autor] of Object.entries(autores) as any) {
      let score = 0;
      const insights: string[] = [];
      
      // Múltiplas visitas
      if (autor.total_reviews >= 3) {
        score += 30;
        insights.push(`Visitou ${autor.total_reviews} corretoras`);
      } else if (autor.total_reviews >= 2) {
        score += 20;
        insights.push(`Visitou ${autor.total_reviews} corretoras`);
      } else {
        score += 10;
      }
      
      // Análise do texto
      for (const visita of autor.corretoras_visitadas) {
        const texto = (visita.review || '').toLowerCase();
        
        if (texto.includes('procurando') || texto.includes('buscando') || 
            texto.includes('interessado') || texto.includes('quero comprar') ||
            texto.includes('investir') || texto.includes('investimento')) {
          score += 20;
          insights.push('Demonstrou interesse em compra');
        }
        
        if (texto.includes('apartamento') || texto.includes('casa') || 
            texto.includes('cobertura') || texto.includes('terreno')) {
          score += 10;
          insights.push('Mencionou tipo de imóvel');
        }
        
        if (/r\$\s*[\d.,]+/.test(texto) || /\d+\s*mil/.test(texto) || /milhão/.test(texto)) {
          score += 15;
          insights.push('Mencionou valores');
        }
        
        if (texto.includes('barra') || texto.includes('recreio') ||
            texto.includes('copacabana') || texto.includes('ipanema') ||
            texto.includes('tijuca')) {
          score += 10;
          insights.push('Mencionou localização');
        }
        
        // Recência
        if (visita.dias_atras <= 7) score += 15;
        else if (visita.dias_atras <= 30) score += 10;
        else if (visita.dias_atras <= 60) score += 5;
        
        if (visita.rating >= 4) score += 5;
      }
      
      score = Math.min(score, 100);
      
      leads.push({
        id: autorId,
        nome: autor.nome,
        foto_url: autor.foto_url,
        score_total: score,
        corretoras_visitadas: autor.corretoras_visitadas,
        total_visitas: autor.total_reviews,
        insights: [...new Set(insights)],
        qualificacao: score >= 70 ? 'super_quente' : score >= 40 ? 'quente' : 'morno',
        status: 'novo',
        cidade: cidadePrincipal
      });
    }

    leads.sort((a, b) => b.score_total - a.score_total);
    const leadsPreQualificados = leads.filter(l => l.score_total >= 20);
    console.log(`📊 Leads pré-qualificados: ${leadsPreQualificados.length}`);

    // ═══════════════════════════════════════════
    // NOVO: VALIDAR LINKEDIN ANTES DE MOSTRAR
    // ═══════════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('🔍 VALIDANDO LINKEDIN DE CADA LEAD...');
    console.log('⏳ Isso pode levar alguns minutos...');
    console.log('═══════════════════════════════════════');

    const leadsValidados: any[] = [];
    let totalValidados = 0;
    let totalDescartados = 0;
    let totalSemLinkedin = 0;

    // Pegar cidade e estado para validação
    const cidadeValidacao = cidades[0] || cidadePrincipal;
    const estadoValidacao = estados[0] || 'RJ';

    for (const lead of leadsPreQualificados.slice(0, max_leads)) {
      console.log(`\n👤 Validando: ${lead.nome}`);
      
      // Buscar LinkedIn via SerpAPI COM CIDADE E ESTADO
      const linkedinData = await buscarLinkedInDetalhado(
        lead.nome,
        cidadeValidacao,
        estadoValidacao
      );
      
      if (linkedinData) {
        const { url: linkedinUrl, snippet } = linkedinData;
        
        lead.linkedin_url = linkedinUrl;
        lead.linkedin_encontrado = true;
        lead.confianca_dados = Math.min(lead.score_total + 30, 100);
        
        console.log(`  ✅ LinkedIn encontrado: ${linkedinUrl}`);
        
        // Verificar se é da CIDADE/ESTADO esperado
        const localizacaoConfere = verificarLocalizacao(
          linkedinUrl,
          snippet,
          cidadeValidacao,
          estadoValidacao
        );
        
        if (localizacaoConfere) {
          console.log(`  ✅ Localização confere: ${cidadeValidacao}, ${estadoValidacao}`);
          leadsValidados.push(lead);
          totalValidados++;
        } else {
          console.log(`  ❌ Localização diferente (DESCARTADO)`);
          totalDescartados++;
        }
        
      } else {
        console.log(`  ⚠️ LinkedIn não encontrado`);
        totalSemLinkedin++;
        
        // Aceitar mesmo sem LinkedIn se score muito alto
        if (lead.score_total >= 60) {
          console.log(`  ✅ Aceito por score alto (${lead.score_total})`);
          lead.confianca_dados = lead.score_total;
          leadsValidados.push(lead);
          totalValidados++;
        } else {
          console.log(`  ❌ Score baixo, descartado sem LinkedIn`);
          totalDescartados++;
        }
      }
      
      // Delay entre validações para não sobrecarregar SerpAPI
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 VALIDAÇÃO COMPLETA:');
    console.log(`Total pré-qualificados: ${leadsPreQualificados.length}`);
    console.log(`✅ Validados (Brasil): ${totalValidados}`);
    console.log(`❌ Descartados (Exterior): ${totalDescartados}`);
    console.log(`⚠️ Sem LinkedIn: ${totalSemLinkedin}`);
    console.log('═══════════════════════════════════════');

    // ═══════════════════════════════════════
    // SALVAR APENAS LEADS VALIDADOS
    // ═══════════════════════════════════════
    console.log('💾 Salvando leads VALIDADOS no banco de dados...');
    
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch (e) {
        console.log('Não conseguiu extrair user_id do token');
      }
    }
    
    let leadsSalvos = 0;
    const leadsSalvosComId: any[] = [];
    
    for (const lead of leadsValidados) {
      try {
        const { data: existente } = await supabase
          .from('leads_imoveis_enriquecidos')
          .select('id')
          .eq('nome', lead.nome)
          .maybeSingle();
        
        if (existente) {
          const { error: updateError } = await supabase
            .from('leads_imoveis_enriquecidos')
            .update({
              score_total: lead.score_total,
              corretoras_visitadas: lead.corretoras_visitadas,
              total_corretoras: lead.total_visitas,
              qualificacao: lead.qualificacao,
              linkedin_url: lead.linkedin_url,
              confianca_dados: lead.confianca_dados,
              cidade: lead.cidade,
              updated_at: new Date().toISOString()
            })
            .eq('id', existente.id);
          
          if (!updateError) {
            leadsSalvosComId.push({ ...lead, id: existente.id });
            leadsSalvos++;
          }
        } else {
          const { data: novoLead, error: insertError } = await supabase
            .from('leads_imoveis_enriquecidos')
            .insert({
              nome: lead.nome,
              foto_url: lead.foto_url,
              google_profile_url: lead.google_profile_url || null,
              score_total: lead.score_total,
              corretoras_visitadas: lead.corretoras_visitadas,
              total_corretoras: lead.total_visitas,
              qualificacao: lead.qualificacao,
              status: 'novo',
              user_id: userId,
              linkedin_url: lead.linkedin_url,
              confianca_dados: lead.confianca_dados,
              cidade: lead.cidade,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!insertError && novoLead) {
            leadsSalvosComId.push({ ...lead, id: novoLead.id });
            leadsSalvos++;
          }
        }
      } catch (e) {
        console.log(`Erro ao salvar lead ${lead.nome}:`, e);
      }
    }
    
    console.log(`✅ ${leadsSalvos} leads VALIDADOS salvos no banco!`);
    
    return new Response(
      JSON.stringify({
        success: true,
        total: leadsValidados.length,
        leads: leadsSalvosComId.length > 0 ? leadsSalvosComId : leadsValidados,
        stats: {
          corretoras_encontradas: corretoras.length,
          reviews_90_dias: todosReviews.length,
          autores_unicos: Object.keys(autores).length,
          pre_qualificados: leadsPreQualificados.length,
          validados_brasil: totalValidados,
          descartados_exterior: totalDescartados,
          sem_linkedin: totalSemLinkedin,
          super_quentes: leadsValidados.filter(l => l.score_total >= 70).length,
          quentes: leadsValidados.filter(l => l.score_total >= 40 && l.score_total < 70).length,
          mornos: leadsValidados.filter(l => l.score_total >= 20 && l.score_total < 40).length,
          salvos_banco: leadsSalvos
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('❌ Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false, leads: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
