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
    console.log('🔍 Iniciando busca AMPLIADA de leads enriquecidos...');
    
    const params = await req.json();
    console.log('Parâmetros recebidos:', params);
    
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    
    if (!GOOGLE_API_KEY) {
      console.log('❌ GOOGLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({
          success: false,
          total: 0,
          leads: [],
          message: 'Configure GOOGLE_API_KEY nas secrets do Supabase para buscar leads reais.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extrair user_id
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const { estados = [], cidades = [] } = params;
    
    // ═══════════════════════════════════════
    // CONSTRUIR QUERIES DE BUSCA AMPLIADAS
    // ═══════════════════════════════════════
    const regioesBusca: string[] = [];

    if (cidades.some((c: string) => c.toLowerCase().includes('rio')) || estados.includes('RJ')) {
      console.log('🏙️ Buscando em TODAS as zonas do Rio de Janeiro...');
      
      // Zona Sul
      regioesBusca.push(
        'corretora imóveis Copacabana Rio de Janeiro',
        'corretora imóveis Ipanema Rio de Janeiro',
        'corretora imóveis Leblon Rio de Janeiro',
        'corretora imóveis Botafogo Rio de Janeiro',
        'corretora imóveis Flamengo Rio de Janeiro',
        'imobiliária Copacabana',
        'imobiliária Ipanema'
      );
      
      // Zona Oeste
      regioesBusca.push(
        'corretora imóveis Barra da Tijuca',
        'corretora imóveis Recreio dos Bandeirantes',
        'corretora imóveis Jacarepaguá',
        'corretora imóveis Campo Grande',
        'imobiliária Barra da Tijuca',
        'imobiliária Recreio'
      );
      
      // Zona Norte (Emergentes!)
      regioesBusca.push(
        'corretora imóveis Tijuca',
        'corretora imóveis Vila Isabel',
        'corretora imóveis Grajaú',
        'corretora imóveis Méier',
        'corretora imóveis Madureira',
        'corretora imóveis Penha',
        'corretora imóveis Ilha do Governador',
        'imobiliária Tijuca',
        'imobiliária Méier'
      );
      
      // Centro
      regioesBusca.push(
        'corretora imóveis Centro Rio de Janeiro',
        'imobiliária Centro Rio de Janeiro'
      );
      
      // INVESTIDORES
      regioesBusca.push(
        'investimento imobiliário Rio de Janeiro',
        'investidor imóveis Rio de Janeiro',
        'compra venda imóveis Rio de Janeiro',
        'consultoria imobiliária Rio de Janeiro'
      );
    } else {
      // Outras cidades
      for (const cidade of cidades) {
        regioesBusca.push(`corretora de imóveis ${cidade}`);
        regioesBusca.push(`imobiliária ${cidade}`);
        regioesBusca.push(`investimento imobiliário ${cidade}`);
      }
    }

    // Se não passou cidades, buscar capitais principais
    if (regioesBusca.length === 0) {
      regioesBusca.push(
        'corretora imóveis Rio de Janeiro',
        'corretora imóveis São Paulo',
        'imobiliária Barra da Tijuca',
        'imobiliária Copacabana'
      );
    }

    console.log(`🔍 Buscando em ${regioesBusca.length} regiões...`);

    // ═══════════════════════════════════════
    // BUSCAR CORRETORAS NO GOOGLE PLACES
    // ═══════════════════════════════════════
    const todasCorretoras: any[] = [];

    for (const queryRegiao of regioesBusca.slice(0, 15)) { // Limitar a 15 queries para não exceder rate limit
      console.log(`  Buscando: ${queryRegiao}`);
      
      try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryRegiao)}&language=pt-BR&key=${GOOGLE_API_KEY}`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results) {
          console.log(`  ✅ ${data.results.length} resultados`);
          todasCorretoras.push(...data.results);
        } else {
          console.log(`  ⚠️ Status: ${data.status}`);
        }
      } catch (err) {
        console.log(`  ❌ Erro na busca: ${err}`);
      }
      
      // Delay para evitar rate limit
      await new Promise(r => setTimeout(r, 300));
    }

    // Remover duplicatas
    const corretoras = Array.from(
      new Map(todasCorretoras.map(c => [c.place_id, c])).values()
    );

    console.log('═══════════════════════════════════════');
    console.log('RESUMO DA BUSCA:');
    console.log(`Regiões buscadas: ${regioesBusca.length}`);
    console.log(`Corretoras encontradas: ${corretoras.length}`);
    console.log('═══════════════════════════════════════');

    // ═══════════════════════════════════════
    // BUSCAR REVIEWS DAS CORRETORAS
    // ═══════════════════════════════════════
    const todosReviews: any[] = [];
    const autores: { [key: string]: any } = {};

    for (const corretora of corretoras.slice(0, 50)) { // Até 50 corretoras
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${corretora.place_id}&fields=name,reviews,formatted_address&language=pt-BR&key=${GOOGLE_API_KEY}`;
        
        const response = await fetch(detailsUrl);
        const data = await response.json();
        
        if (data.status === 'OK' && data.result?.reviews) {
          // Filtrar reviews dos últimos 90 dias
          const reviewsRecentes = data.result.reviews.filter((r: any) => {
            const diasAtras = Math.floor((Date.now() / 1000 - r.time) / 86400);
            return diasAtras <= 90; // 3 meses
          });
          
          console.log(`  ${corretora.name}: ${reviewsRecentes.length} reviews (90 dias)`);
          
          for (const review of reviewsRecentes) {
            const autorId = review.author_name?.toLowerCase().replace(/\s+/g, '_') || 'anonimo';
            
            if (!autores[autorId]) {
              autores[autorId] = {
                nome: review.author_name,
                foto_url: review.profile_photo_url,
                corretoras_visitadas: [],
                total_reviews: 0
              };
            }
            
            autores[autorId].corretoras_visitadas.push({
              nome: corretora.name,
              endereco: data.result.formatted_address,
              review: review.text,
              rating: review.rating,
              data: review.relative_time_description
            });
            autores[autorId].total_reviews++;
            
            todosReviews.push({
              autor: review.author_name,
              corretora: corretora.name,
              texto: review.text,
              rating: review.rating
            });
          }
        }
      } catch (err) {
        console.log(`  ❌ Erro ao buscar reviews: ${err}`);
      }
      
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('═══════════════════════════════════════');
    console.log('RESUMO DOS REVIEWS:');
    console.log(`Total reviews: ${todosReviews.length}`);
    console.log(`Autores únicos: ${Object.keys(autores).length}`);
    console.log('═══════════════════════════════════════');

    // ═══════════════════════════════════════
    // CALCULAR SCORE DE CADA LEAD
    // ═══════════════════════════════════════
    const leads: any[] = [];

    for (const [autorId, autor] of Object.entries(autores) as any) {
      let score = 0;
      const insights: string[] = [];
      
      // Múltiplas visitas = mais interesse
      if (autor.total_reviews >= 3) {
        score += 30;
        insights.push(`Visitou ${autor.total_reviews} corretoras`);
      } else if (autor.total_reviews >= 2) {
        score += 20;
        insights.push(`Visitou ${autor.total_reviews} corretoras`);
      } else {
        score += 10;
      }
      
      // Análise do texto dos reviews
      for (const visita of autor.corretoras_visitadas) {
        const texto = (visita.review || '').toLowerCase();
        
        // Interesse em compra/venda
        if (texto.includes('procurando') || texto.includes('buscando') || 
            texto.includes('interessado') || texto.includes('quero comprar') ||
            texto.includes('investir') || texto.includes('investimento')) {
          score += 20;
          insights.push('Demonstrou interesse em compra');
        }
        
        // Tipo de imóvel
        if (texto.includes('apartamento') || texto.includes('casa') || 
            texto.includes('cobertura') || texto.includes('terreno')) {
          score += 10;
          insights.push('Mencionou tipo de imóvel');
        }
        
        // Mencionou valor
        if (/r\$\s*[\d.,]+/.test(texto) || /\d+\s*mil/.test(texto) || /\d+\s*milhão/.test(texto)) {
          score += 15;
          insights.push('Mencionou valores');
        }
        
        // Localização específica
        if (texto.includes('barra') || texto.includes('recreio') ||
            texto.includes('copacabana') || texto.includes('ipanema') ||
            texto.includes('tijuca') || texto.includes('zona norte')) {
          score += 10;
          insights.push('Mencionou localização');
        }
        
        // Recência
        if (visita.data?.includes('dia') || visita.data?.includes('semana')) {
          score += 15;
        } else if (visita.data?.includes('mês')) {
          score += 5;
        }
        
        // Rating alto = experiência boa, pode voltar
        if (visita.rating >= 4) {
          score += 5;
        }
      }
      
      // Cap score at 100
      score = Math.min(score, 100);
      
      leads.push({
        id: autorId,
        nome: autor.nome,
        foto_url: autor.foto_url,
        score_total: score,
        corretoras_visitadas: autor.corretoras_visitadas,
        total_visitas: autor.total_reviews,
        insights: [...new Set(insights)],
        qualificacao: score >= 70 ? 'super_quente' : score >= 40 ? 'quente' : 'morno'
      });
    }

    // Ordenar por score
    leads.sort((a, b) => b.score_total - a.score_total);
    
    // Filtrar por score mínimo (20)
    const leadsQualificados = leads.filter(l => l.score_total >= 20);

    console.log('═══════════════════════════════════════');
    console.log('RESUMO DOS LEADS:');
    console.log(`Total leads: ${leads.length}`);
    console.log(`Qualificados (>=20): ${leadsQualificados.length}`);
    console.log(`Super Quentes (>=70): ${leads.filter(l => l.score_total >= 70).length}`);
    console.log(`Quentes (40-69): ${leads.filter(l => l.score_total >= 40 && l.score_total < 70).length}`);
    console.log(`Mornos (20-39): ${leads.filter(l => l.score_total >= 20 && l.score_total < 40).length}`);
    console.log('═══════════════════════════════════════');
    
    return new Response(
      JSON.stringify({
        success: true,
        total: leadsQualificados.length,
        leads: leadsQualificados,
        stats: {
          regioes_buscadas: regioesBusca.length,
          corretoras_encontradas: corretoras.length,
          reviews_analisados: todosReviews.length,
          autores_unicos: Object.keys(autores).length
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
