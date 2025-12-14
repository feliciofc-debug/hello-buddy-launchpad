import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('🧪 TESTE LINKEDIN INICIADO');

  try {
    const { nome, empresa } = await req.json();
    
    console.log('🔍 Testando busca LinkedIn para:', nome);
    console.log('🏢 Empresa (opcional):', empresa);
    
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_CX');
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CREDENCIAIS:');
    console.log('   GOOGLE_API_KEY existe?', !!GOOGLE_API_KEY);
    console.log('   GOOGLE_CX existe?', !!GOOGLE_CX);
    console.log('   SERPAPI_KEY existe?', !!SERPAPI_KEY);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resultados: any = {
      queries_testadas: [],
      perfis_encontrados: [],
      nome_buscado: nome,
      empresa_buscada: empresa
    };

    // Múltiplas queries - do mais simples ao mais específico
    const queries = [
      `${nome} linkedin`,
      `${nome} linkedin.com`,
      `"${nome}" linkedin`,
      `${nome} Rio de Janeiro linkedin`,
    ];

    if (empresa) {
      queries.push(`${nome} ${empresa} linkedin`);
    }

    console.log('📝 Queries a testar:', queries.length);

    // Testar com SerpAPI (mais confiável)
    if (SERPAPI_KEY) {
      console.log('');
      console.log('🔍 USANDO SERPAPI');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      for (const query of queries) {
        console.log('');
        console.log(`📌 Query: "${query}"`);
        
        try {
          const urlSerpapi = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=10&engine=google`;
          
          const resSerpapi = await fetch(urlSerpapi);
          const dataSerpapi = await resSerpapi.json();
          
          if (dataSerpapi.error) {
            console.log('   ❌ ERRO:', dataSerpapi.error);
            resultados.queries_testadas.push({
              query,
              sucesso: false,
              erro: dataSerpapi.error
            });
            continue;
          }
          
          const items = dataSerpapi.organic_results || [];
          console.log('   Total resultados:', items.length);
          
          // Filtrar LinkedIn
          const linkedinUrls = items
            .filter((item: any) => item.link?.includes('linkedin.com/in/'))
            .map((item: any) => ({
              titulo: item.title,
              link: item.link,
              snippet: item.snippet?.substring(0, 100)
            }));
          
          console.log('   LinkedIn encontrados:', linkedinUrls.length);
          
          if (linkedinUrls.length > 0) {
            linkedinUrls.forEach((l: any, i: number) => {
              console.log(`   ${i + 1}. ${l.link}`);
              console.log(`      Título: ${l.titulo}`);
              
              // Adiciona sem duplicar
              if (!resultados.perfis_encontrados.find((p: any) => p.link === l.link)) {
                resultados.perfis_encontrados.push(l);
              }
            });
          }
          
          resultados.queries_testadas.push({
            query,
            sucesso: true,
            total_resultados: items.length,
            linkedin_encontrados: linkedinUrls.length
          });
          
          // Se encontrou perfis LinkedIn, pode parar
          if (linkedinUrls.length > 0) {
            console.log('');
            console.log('✅ ENCONTROU! Parando busca.');
            break;
          }
          
        } catch (e: any) {
          console.log('   ❌ EXCEÇÃO:', e.message);
          resultados.queries_testadas.push({
            query,
            sucesso: false,
            erro: e.message
          });
        }
      }
    }

    // Se não encontrou com SerpAPI, tenta Google
    if (resultados.perfis_encontrados.length === 0 && GOOGLE_API_KEY && GOOGLE_CX) {
      console.log('');
      console.log('🔍 FALLBACK: Google Custom Search');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      for (const query of queries) {
        console.log('');
        console.log(`📌 Query: "${query}"`);
        
        try {
          const urlGoogle = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=10`;
          
          const resGoogle = await fetch(urlGoogle);
          const dataGoogle = await resGoogle.json();
          
          if (dataGoogle.error) {
            console.log('   ❌ ERRO:', dataGoogle.error.message);
            continue;
          }
          
          const items = dataGoogle.items || [];
          console.log('   Total resultados:', items.length);
          
          const linkedinUrls = items
            .filter((item: any) => item.link?.includes('linkedin.com/in/'))
            .map((item: any) => ({
              titulo: item.title,
              link: item.link,
              snippet: item.snippet?.substring(0, 100)
            }));
          
          console.log('   LinkedIn encontrados:', linkedinUrls.length);
          
          if (linkedinUrls.length > 0) {
            linkedinUrls.forEach((l: any, i: number) => {
              console.log(`   ${i + 1}. ${l.link}`);
              
              if (!resultados.perfis_encontrados.find((p: any) => p.link === l.link)) {
                resultados.perfis_encontrados.push(l);
              }
            });
            
            console.log('');
            console.log('✅ ENCONTROU! Parando busca.');
            break;
          }
          
        } catch (e: any) {
          console.log('   ❌ EXCEÇÃO:', e.message);
        }
      }
    }

    // ============================================
    // RESUMO FINAL
    // ============================================
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMO FINAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Nome buscado:', nome);
    console.log('   Queries testadas:', resultados.queries_testadas.length);
    console.log('   Perfis LinkedIn encontrados:', resultados.perfis_encontrados.length);
    
    if (resultados.perfis_encontrados.length > 0) {
      console.log('');
      console.log('🎯 PERFIS:');
      resultados.perfis_encontrados.forEach((p: any, i: number) => {
        console.log(`   ${i + 1}. ${p.link}`);
      });
    } else {
      console.log('');
      console.log('❌ Nenhum perfil LinkedIn encontrado para:', nome);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return new Response(
      JSON.stringify({
        success: resultados.perfis_encontrados.length > 0,
        total_encontrados: resultados.perfis_encontrados.length,
        perfis: resultados.perfis_encontrados,
        detalhes: resultados
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
