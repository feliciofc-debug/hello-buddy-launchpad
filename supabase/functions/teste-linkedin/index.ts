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
    console.log('   GOOGLE_API_KEY existe?', !!GOOGLE_API_KEY, GOOGLE_API_KEY ? `(${GOOGLE_API_KEY.substring(0, 10)}...)` : '');
    console.log('   GOOGLE_CX existe?', !!GOOGLE_CX, GOOGLE_CX ? `(${GOOGLE_CX})` : '');
    console.log('   SERPAPI_KEY existe?', !!SERPAPI_KEY, SERPAPI_KEY ? `(${SERPAPI_KEY.substring(0, 10)}...)` : '');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resultados: any = {
      teste_google: null,
      teste_serpapi: null,
      nome_buscado: nome,
      empresa_buscada: empresa
    };

    // ============================================
    // TESTE 1: Google Custom Search API
    // ============================================
    if (GOOGLE_API_KEY && GOOGLE_CX) {
      console.log('');
      console.log('🔍 TESTE 1: Google Custom Search API');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const queryGoogle = `"${nome}" ${empresa || ''} site:linkedin.com/in/`;
        console.log('   Query:', queryGoogle);
        
        const urlGoogle = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(queryGoogle)}&num=5`;
        console.log('   URL:', urlGoogle.substring(0, 80) + '...');
        
        const resGoogle = await fetch(urlGoogle);
        console.log('   Status:', resGoogle.status, resGoogle.statusText);
        
        const dataGoogle = await resGoogle.json();
        
        if (dataGoogle.error) {
          console.log('   ❌ ERRO:', dataGoogle.error.message);
          resultados.teste_google = {
            sucesso: false,
            status: resGoogle.status,
            erro: dataGoogle.error.message,
            detalhes: dataGoogle.error
          };
        } else {
          const items = dataGoogle.items || [];
          console.log('   ✅ Resultados encontrados:', items.length);
          
          const linkedinUrls = items
            .filter((item: any) => item.link?.includes('linkedin.com/in/'))
            .map((item: any) => ({
              titulo: item.title,
              link: item.link,
              snippet: item.snippet?.substring(0, 100)
            }));
          
          console.log('   LinkedIn URLs:', linkedinUrls.length);
          linkedinUrls.forEach((l: any, i: number) => {
            console.log(`   ${i + 1}. ${l.link}`);
          });
          
          resultados.teste_google = {
            sucesso: true,
            status: resGoogle.status,
            total_resultados: items.length,
            linkedin_encontrados: linkedinUrls.length,
            perfis: linkedinUrls
          };
        }
      } catch (e: any) {
        console.log('   ❌ EXCEÇÃO:', e.message);
        resultados.teste_google = {
          sucesso: false,
          erro: e.message
        };
      }
    } else {
      console.log('');
      console.log('⚠️ GOOGLE API não configurada - pulando teste');
      resultados.teste_google = {
        sucesso: false,
        erro: 'GOOGLE_API_KEY ou GOOGLE_CX não configurados'
      };
    }

    // ============================================
    // TESTE 2: SerpAPI (backup)
    // ============================================
    if (SERPAPI_KEY) {
      console.log('');
      console.log('🔍 TESTE 2: SerpAPI');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const querySerpapi = `${nome} ${empresa || ''} site:linkedin.com/in/`;
        console.log('   Query:', querySerpapi);
        
        const urlSerpapi = `https://serpapi.com/search.json?q=${encodeURIComponent(querySerpapi)}&api_key=${SERPAPI_KEY}&num=5`;
        console.log('   URL:', urlSerpapi.substring(0, 60) + '...');
        
        const resSerpapi = await fetch(urlSerpapi);
        console.log('   Status:', resSerpapi.status, resSerpapi.statusText);
        
        const dataSerpapi = await resSerpapi.json();
        
        if (dataSerpapi.error) {
          console.log('   ❌ ERRO:', dataSerpapi.error);
          resultados.teste_serpapi = {
            sucesso: false,
            status: resSerpapi.status,
            erro: dataSerpapi.error
          };
        } else {
          const items = dataSerpapi.organic_results || [];
          console.log('   ✅ Resultados encontrados:', items.length);
          
          const linkedinUrls = items
            .filter((item: any) => item.link?.includes('linkedin.com/in/'))
            .map((item: any) => ({
              titulo: item.title,
              link: item.link,
              snippet: item.snippet?.substring(0, 100)
            }));
          
          console.log('   LinkedIn URLs:', linkedinUrls.length);
          linkedinUrls.forEach((l: any, i: number) => {
            console.log(`   ${i + 1}. ${l.link}`);
          });
          
          resultados.teste_serpapi = {
            sucesso: true,
            status: resSerpapi.status,
            total_resultados: items.length,
            linkedin_encontrados: linkedinUrls.length,
            perfis: linkedinUrls
          };
        }
      } catch (e: any) {
        console.log('   ❌ EXCEÇÃO:', e.message);
        resultados.teste_serpapi = {
          sucesso: false,
          erro: e.message
        };
      }
    } else {
      console.log('');
      console.log('⚠️ SERPAPI não configurada - pulando teste');
      resultados.teste_serpapi = {
        sucesso: false,
        erro: 'SERPAPI_KEY não configurado'
      };
    }

    // ============================================
    // RESUMO FINAL
    // ============================================
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMO DO TESTE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Google:', resultados.teste_google?.sucesso ? `✅ ${resultados.teste_google.linkedin_encontrados} perfis` : `❌ ${resultados.teste_google?.erro}`);
    console.log('   SerpAPI:', resultados.teste_serpapi?.sucesso ? `✅ ${resultados.teste_serpapi.linkedin_encontrados} perfis` : `❌ ${resultados.teste_serpapi?.erro}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return new Response(
      JSON.stringify({
        success: true,
        resultados
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
