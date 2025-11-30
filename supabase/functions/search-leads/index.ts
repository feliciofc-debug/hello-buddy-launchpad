import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    console.log("🚀 Iniciando busca de leads REAIS...");
    
    const { campanha_id, icp_config_id } = await req.json();
    console.log("📋 IDs recebidos:", { campanha_id, icp_config_id });
    
    // 1. Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError || !icp) {
      console.error("❌ ICP não encontrado:", icpError);
      throw new Error(`ICP não encontrado: ${icpError?.message || 'ID inválido'}`);
    }
    
    console.log("✅ ICP encontrado:", icp.nome);
    
    // Extrair dados do ICP
    const profissao = icp.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icp.filtros_avancados?.estados?.[0] === 'RJ' ? 'Rio de Janeiro' : 
                   icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.filtros_avancados?.estados?.[0] || "RJ";

    console.log("🔍 Buscando leads REAIS para:", { profissao, cidade, estado });

    const APIFY_TOKEN = Deno.env.get('APIFY_API_KEY');
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_CX');

    let leads: any[] = [];
    const searchQuery = `${profissao} ${cidade}`;

    // ==== MÉTODO 1: SERPAPI (Google Search) ====
    if (SERPAPI_KEY && leads.length === 0) {
      console.log("🔍 Tentando SerpAPI Google Search...");
      
      try {
        const serpQueries = [
          `site:linkedin.com/in "${profissao}" "${cidade}"`,
          `site:instagram.com "${profissao}" "${cidade}" consultorio`,
          `"${profissao}" "${cidade}" telefone contato`
        ];

        for (const query of serpQueries) {
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=20&api_key=${SERPAPI_KEY}`;
          
          const serpResponse = await fetch(serpUrl);
          
          if (serpResponse.ok) {
            const serpData = await serpResponse.json();
            const results = serpData.organic_results || [];
            
            console.log(`📊 SerpAPI: ${results.length} resultados para: ${query.substring(0, 50)}...`);
            
            for (const result of results) {
              // Extrair dados do resultado
              const isLinkedIn = result.link?.includes('linkedin.com/in/');
              const isInstagram = result.link?.includes('instagram.com/');
              
              // Extrair nome do título ou snippet
              let nome = '';
              if (isLinkedIn) {
                nome = result.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || '';
              } else if (isInstagram) {
                nome = result.title?.replace('@', '')?.split(' ')[0] || '';
              } else {
                // Tentar extrair nome de outros resultados
                const nomeMatch = result.snippet?.match(/(?:Dr\.|Dra\.|Dr|Dra)?\s*([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)+)/);
                nome = nomeMatch?.[1] || result.title?.split(' - ')[0] || '';
              }

              if (!nome || nome.length < 3) continue;

              // Verificar se já existe
              const exists = leads.find(l => l.nome_completo.toLowerCase() === nome.toLowerCase());
              if (exists) {
                // Merge dados
                if (isLinkedIn) exists.linkedin_url = result.link;
                if (isInstagram) exists.instagram_username = result.link?.split('instagram.com/')[1]?.split('/')[0];
                exists.score = (exists.score || 40) + 5;
                continue;
              }

              // Extrair telefone do snippet
              const telefoneMatch = result.snippet?.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
              
              // Extrair email do snippet
              const emailMatch = result.snippet?.match(/[\w.-]+@[\w.-]+\.\w+/);

              leads.push({
                nome_completo: nome,
                profissao: profissao,
                especialidade: result.snippet?.includes('especialista') ? result.snippet.substring(0, 100) : null,
                cidade: cidade,
                estado: estado,
                linkedin_url: isLinkedIn ? result.link : null,
                instagram_username: isInstagram ? result.link?.split('instagram.com/')[1]?.split('/')[0] : null,
                email: emailMatch?.[0] || null,
                telefone: telefoneMatch?.[0] || null,
                site_url: !isLinkedIn && !isInstagram ? result.link : null,
                fonte: isLinkedIn ? 'linkedin_google' : isInstagram ? 'instagram_google' : 'google_search',
                fonte_url: result.link,
                fonte_snippet: result.snippet?.substring(0, 300),
                query_usada: query,
                pipeline_status: 'descoberto',
                score: isLinkedIn ? 55 : isInstagram ? 50 : 40,
                campanha_id,
                user_id: icp.user_id
              });
            }
          }
          
          // Pequeno delay entre requests
          await new Promise(r => setTimeout(r, 500));
        }
        
        console.log(`✅ SerpAPI total: ${leads.length} leads encontrados`);
      } catch (serpError) {
        console.warn("⚠️ Erro SerpAPI:", serpError);
      }
    }

    // ==== MÉTODO 2: GOOGLE CUSTOM SEARCH ====
    if (GOOGLE_API_KEY && GOOGLE_CX && leads.length < 10) {
      console.log("🔍 Tentando Google Custom Search API...");
      
      try {
        const googleQuery = `${profissao} ${cidade} LinkedIn OR Instagram contato`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(googleQuery)}&num=10`;
        
        const googleResponse = await fetch(googleUrl);
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          const items = googleData.items || [];
          
          console.log(`📊 Google CSE: ${items.length} resultados`);
          
          for (const item of items) {
            const isLinkedIn = item.link?.includes('linkedin.com/in/');
            const isInstagram = item.link?.includes('instagram.com/');
            
            let nome = '';
            if (isLinkedIn) {
              nome = item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || '';
            } else {
              const nomeMatch = item.snippet?.match(/(?:Dr\.|Dra\.)?\s*([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)+)/);
              nome = nomeMatch?.[1] || '';
            }

            if (!nome || nome.length < 3) continue;
            
            const exists = leads.find(l => l.nome_completo.toLowerCase() === nome.toLowerCase());
            if (exists) continue;

            leads.push({
              nome_completo: nome,
              profissao: profissao,
              cidade: cidade,
              estado: estado,
              linkedin_url: isLinkedIn ? item.link : null,
              instagram_username: isInstagram ? item.link?.split('instagram.com/')[1]?.split('/')[0] : null,
              fonte: 'google_cse',
              fonte_url: item.link,
              fonte_snippet: item.snippet?.substring(0, 300),
              query_usada: googleQuery,
              pipeline_status: 'descoberto',
              score: isLinkedIn ? 55 : 40,
              campanha_id,
              user_id: icp.user_id
            });
          }
        }
      } catch (googleError) {
        console.warn("⚠️ Erro Google CSE:", googleError);
      }
    }

    // ==== MÉTODO 3: APIFY (se disponível e ainda precisar de mais leads) ====
    if (APIFY_TOKEN && leads.length < 20) {
      console.log("🔗 Tentando Apify...");
      
      try {
        // Tentar Google Search Scraper do Apify (mais confiável)
        const apifyResponse = await fetch('https://api.apify.com/v2/acts/apify~google-search-scraper/runs?waitForFinish=120', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`
          },
          body: JSON.stringify({
            queries: `site:linkedin.com/in "${profissao}" "${cidade}"`,
            maxPagesPerQuery: 2,
            resultsPerPage: 20,
            languageCode: "pt",
            countryCode: "br"
          })
        });

        if (apifyResponse.ok) {
          const runData = await apifyResponse.json();
          const runId = runData.data?.id;

          if (runId) {
            console.log(`✅ Run Apify Google Search: ${runId}`);
            
            const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
              headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
            });

            const apifyResults = await resultsResponse.json();
            console.log(`📊 Apify Google: ${apifyResults.length} resultados`);

            for (const result of apifyResults) {
              const organicResults = result.organicResults || [];
              
              for (const item of organicResults) {
                if (!item.url?.includes('linkedin.com/in/')) continue;
                
                const nome = item.title?.split(' - ')[0]?.split(' | ')[0]?.trim();
                if (!nome || nome.length < 3) continue;
                
                const exists = leads.find(l => l.nome_completo.toLowerCase() === nome.toLowerCase());
                if (exists) continue;

                leads.push({
                  nome_completo: nome,
                  profissao: item.title?.includes('-') ? item.title.split('-')[1]?.trim() : profissao,
                  cidade: cidade,
                  estado: estado,
                  linkedin_url: item.url,
                  fonte: 'apify_google',
                  fonte_url: item.url,
                  fonte_snippet: item.description?.substring(0, 300),
                  query_usada: searchQuery,
                  pipeline_status: 'descoberto',
                  score: 55,
                  campanha_id,
                  user_id: icp.user_id
                });
              }
            }
          }
        }
      } catch (apifyError) {
        console.warn("⚠️ Erro Apify:", apifyError);
      }
    }

    console.log(`✅ Total de leads processados: ${leads.length}`);

    if (leads.length === 0) {
      console.warn("⚠️ Nenhum lead encontrado com nenhum método");
      return new Response(
        JSON.stringify({
          success: false,
          leads_encontrados: 0,
          message: "Nenhum lead encontrado. Verifique se as APIs (SERPAPI_KEY, GOOGLE_API_KEY, APIFY_API_KEY) estão configuradas corretamente."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ==== SALVAR LEADS NO BANCO ====
    console.log(`💾 Salvando ${leads.length} leads REAIS no banco...`);

    // Remover duplicatas por nome
    const uniqueLeads = leads.filter((lead, index, self) =>
      index === self.findIndex(l => l.nome_completo.toLowerCase() === lead.nome_completo.toLowerCase())
    );

    const { error: insertError } = await supabase
      .from("leads_b2c")
      .insert(uniqueLeads);
    
    if (insertError) {
      console.error("❌ Erro ao salvar:", insertError);
      throw insertError;
    }

    // Atualizar estatísticas da campanha
    await supabase
      .from("campanhas_prospeccao")
      .update({
        stats: {
          descobertos: uniqueLeads.length,
          enriquecidos: 0,
          qualificados: 0,
          enviados: 0,
          responderam: 0,
          convertidos: 0
        }
      })
      .eq("id", campanha_id);

    console.log(`🎉 Busca REAL concluída: ${uniqueLeads.length} leads salvos!`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: uniqueLeads.length,
        message: `${uniqueLeads.length} leads REAIS encontrados!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ ERRO:", errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        leads_encontrados: 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
