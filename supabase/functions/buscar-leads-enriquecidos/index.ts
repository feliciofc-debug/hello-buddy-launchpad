import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        status: 'novo'
      });
    }

    leads.sort((a, b) => b.score_total - a.score_total);
    const leadsQualificados = leads.filter(l => l.score_total >= 20).slice(0, max_leads);
    console.log(`📊 Leads qualificados (limitado a ${max_leads}): ${leadsQualificados.length}`);

    console.log('═══════════════════════════════════════');
    console.log('📊 RESUMO FINAL:');
    console.log(`Corretoras: ${corretoras.length}`);
    console.log(`Reviews 90 dias: ${todosReviews.length}`);
    console.log(`Autores únicos: ${Object.keys(autores).length}`);
    console.log(`Leads qualificados: ${leadsQualificados.length}`);
    console.log('═══════════════════════════════════════');

    // ═══════════════════════════════════════
    // FASE 5: ENRIQUECER E SALVAR NO BANCO
    // ═══════════════════════════════════════
    console.log('🔍 Iniciando enriquecimento dos leads...');
    
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
    
    const leadsEnriquecidos: any[] = [];
    let processados = 0;
    
    for (const lead of leadsQualificados) {
      processados++;
      console.log(`\n👤 [${processados}/${leadsQualificados.length}] Enriquecendo: ${lead.nome}`);
      
      let telefone = null;
      let email = null;
      let linkedin_url = null;
      let linkedin_foto = null;
      let cargo = null;
      let empresa = null;
      let instagram_username = null;
      let instagram_url = null;
      let instagram_foto = null;
      let instagram_followers = 0;
      let linkedin_encontrado = false;
      let instagram_encontrado = false;
      let confianca = lead.score_total;
      
      // ───────────────────────────────────────────
      // BUSCAR LINKEDIN (Apify)
      // ───────────────────────────────────────────
      try {
        console.log('  💼 Buscando LinkedIn...');
        
        const linkedinActorId = 'bebity~linkedin-people-search';
        const linkedinUrl = `https://api.apify.com/v2/acts/${linkedinActorId}/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
        
        const linkedinResponse = await fetch(linkedinUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: lead.nome,
            maxResults: 2,
            deepScrape: false
          }),
          signal: AbortSignal.timeout(20000)
        });
        
        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json();
          
          if (linkedinData && linkedinData.length > 0) {
            const profile = linkedinData[0];
            linkedin_url = profile.url || profile.profileUrl || profile.linkedinUrl;
            linkedin_foto = profile.profilePicture || profile.photoUrl;
            cargo = profile.title || profile.headline || profile.currentPosition;
            empresa = profile.company || profile.companyName;
            email = profile.email;
            linkedin_encontrado = true;
            confianca += 30;
            console.log('  ✅ LinkedIn encontrado:', linkedin_url);
          } else {
            console.log('  ⚠️ LinkedIn: nenhum resultado');
          }
        } else {
          console.log('  ⚠️ LinkedIn API error:', linkedinResponse.status);
        }
      } catch (linkedinError: any) {
        console.log('  ❌ LinkedIn timeout/erro:', linkedinError.message);
      }
      
      // ───────────────────────────────────────────
      // BUSCAR INSTAGRAM (Apify)
      // ───────────────────────────────────────────
      try {
        console.log('  📸 Buscando Instagram...');
        
        const firstName = lead.nome.split(' ')[0]?.toLowerCase() || '';
        const lastName = lead.nome.split(' ').slice(-1)[0]?.toLowerCase() || '';
        
        const possibleUsernames = [
          firstName + lastName,
          firstName + '_' + lastName,
          firstName + '.' + lastName,
          firstName
        ].filter(u => u && u.length > 2);
        
        const instagramActorId = 'apify~instagram-profile-scraper';
        const instagramUrl = `https://api.apify.com/v2/acts/${instagramActorId}/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
        
        const instagramResponse = await fetch(instagramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usernames: possibleUsernames.slice(0, 2)
          }),
          signal: AbortSignal.timeout(20000)
        });
        
        if (instagramResponse.ok) {
          const instagramData = await instagramResponse.json();
          
          if (instagramData && instagramData.length > 0) {
            const profile = instagramData[0];
            instagram_username = profile.username;
            instagram_url = `https://instagram.com/${profile.username}`;
            instagram_foto = profile.profilePicUrl || profile.profilePicture;
            instagram_followers = profile.followersCount || 0;
            instagram_encontrado = true;
            confianca += 20;
            console.log('  ✅ Instagram encontrado:', instagram_username);
          } else {
            console.log('  ⚠️ Instagram: nenhum resultado');
          }
        } else {
          console.log('  ⚠️ Instagram API error:', instagramResponse.status);
        }
      } catch (instagramError: any) {
        console.log('  ❌ Instagram timeout/erro:', instagramError.message);
      }
      
      const dados_completos = linkedin_encontrado || instagram_encontrado;
      
      const leadEnriquecido = {
        id: lead.id,
        nome: lead.nome,
        foto_url: lead.foto_url,
        google_profile_url: lead.google_profile_url || null,
        score_total: lead.score_total,
        corretoras_visitadas: lead.corretoras_visitadas,
        total_corretoras: lead.total_visitas,
        qualificacao: lead.qualificacao,
        insights: lead.insights,
        status: 'novo',
        telefone,
        email,
        linkedin_url,
        linkedin_foto,
        cargo,
        empresa,
        linkedin_encontrado,
        instagram_username,
        instagram_url,
        instagram_foto,
        instagram_followers,
        instagram_encontrado,
        facebook_encontrado: false,
        dados_completos,
        confianca_dados: Math.min(confianca, 100),
        data_enriquecimento: new Date().toISOString(),
        user_id: userId
      };
      
      leadsEnriquecidos.push(leadEnriquecido);
      
      // Salvar no banco imediatamente
      try {
        const { data: existente } = await supabase
          .from('leads_imoveis_enriquecidos')
          .select('id')
          .eq('nome', lead.nome)
          .maybeSingle();
        
        if (existente) {
          await supabase
            .from('leads_imoveis_enriquecidos')
            .update({
              ...leadEnriquecido,
              updated_at: new Date().toISOString()
            })
            .eq('id', existente.id);
          leadEnriquecido.id = existente.id;
        } else {
          const { data: novoLead } = await supabase
            .from('leads_imoveis_enriquecidos')
            .insert(leadEnriquecido)
            .select('id')
            .single();
          if (novoLead) leadEnriquecido.id = novoLead.id;
        }
      } catch (saveError: any) {
        console.log('  ⚠️ Erro ao salvar:', saveError.message);
      }
      
      // Delay entre leads (evitar rate limit)
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📊 RESUMO ENRIQUECIMENTO:');
    console.log(`Total processados: ${leadsEnriquecidos.length}`);
    console.log(`Com LinkedIn: ${leadsEnriquecidos.filter(l => l.linkedin_encontrado).length}`);
    console.log(`Com Instagram: ${leadsEnriquecidos.filter(l => l.instagram_encontrado).length}`);
    console.log(`Dados completos: ${leadsEnriquecidos.filter(l => l.dados_completos).length}`);
    console.log('═══════════════════════════════════════');
    
    return new Response(
      JSON.stringify({
        success: true,
        total: leadsEnriquecidos.length,
        leads: leadsEnriquecidos,
        stats: {
          corretoras_encontradas: corretoras.length,
          reviews_90_dias: todosReviews.length,
          autores_unicos: Object.keys(autores).length,
          com_linkedin: leadsEnriquecidos.filter(l => l.linkedin_encontrado).length,
          com_instagram: leadsEnriquecidos.filter(l => l.instagram_encontrado).length,
          dados_completos: leadsEnriquecidos.filter(l => l.dados_completos).length
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