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
    console.log("🚀 [V2] Iniciando busca de leads...");
    
    const { campanha_id, icp_config_id } = await req.json();
    console.log("📋 IDs:", { campanha_id, icp_config_id });
    
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
    
    console.log("✅ ICP:", icp.nome);
    
    // Extrair dados do ICP
    const profissao = icp.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icp.filtros_avancados?.estados?.[0] === 'RJ' ? 'Rio de Janeiro' : 
                   icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.filtros_avancados?.estados?.[0] || "RJ";

    console.log("🔍 Busca:", { profissao, cidade, estado });

    // Verificar APIs disponíveis
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_CX');
    const APIFY_TOKEN = Deno.env.get('APIFY_API_KEY');

    console.log("🔑 APIs configuradas:", {
      serpapi: !!SERPAPI_KEY,
      google: !!GOOGLE_API_KEY,
      googleCx: !!GOOGLE_CX,
      apify: !!APIFY_TOKEN
    });

    let leads: any[] = [];

    // ==== MÉTODO 1: SERPAPI (Google Search) - MAIS CONFIÁVEL ====
    if (SERPAPI_KEY) {
      console.log("🔍 [SERPAPI] Iniciando busca...");
      
      try {
        const queries = [
          `site:linkedin.com/in "${profissao}" "${cidade}"`,
          `"${profissao}" "${cidade}" consultório contato telefone`
        ];

        for (const query of queries) {
          console.log(`🔍 [SERPAPI] Query: ${query.substring(0, 60)}...`);
          
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Brazil&hl=pt&gl=br&num=20&api_key=${SERPAPI_KEY}`;
          
          const serpResponse = await fetch(serpUrl);
          const serpStatus = serpResponse.status;
          
          console.log(`📡 [SERPAPI] Status: ${serpStatus}`);
          
          if (serpResponse.ok) {
            const serpData = await serpResponse.json();
            const results = serpData.organic_results || [];
            
            console.log(`📊 [SERPAPI] Resultados: ${results.length}`);
            
            if (serpData.error) {
              console.error("❌ [SERPAPI] Erro na resposta:", serpData.error);
              continue;
            }
            
            for (const result of results) {
              const isLinkedIn = result.link?.includes('linkedin.com/in/');
              const isInstagram = result.link?.includes('instagram.com/');
              
              let nome = '';
              if (isLinkedIn) {
                nome = result.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || '';
              } else if (isInstagram) {
                nome = result.title?.replace('@', '')?.split(' ')[0] || '';
              } else {
                const nomeMatch = result.snippet?.match(/(?:Dr\.|Dra\.|Dr|Dra)?\s*([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)+)/);
                nome = nomeMatch?.[1] || result.title?.split(' - ')[0] || '';
              }

              if (!nome || nome.length < 3) continue;

              const exists = leads.find(l => l.nome_completo?.toLowerCase() === nome.toLowerCase());
              if (exists) {
                if (isLinkedIn) exists.linkedin_url = result.link;
                if (isInstagram) exists.instagram_username = result.link?.split('instagram.com/')[1]?.split('/')[0];
                exists.score = (exists.score || 40) + 5;
                continue;
              }

              const telefoneMatch = result.snippet?.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
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
                fonte: isLinkedIn ? 'linkedin_serpapi' : isInstagram ? 'instagram_serpapi' : 'google_serpapi',
                fonte_url: result.link,
                fonte_snippet: result.snippet?.substring(0, 300),
                query_usada: query,
                pipeline_status: 'descoberto',
                score: isLinkedIn ? 55 : isInstagram ? 50 : 40,
                campanha_id,
                user_id: icp.user_id
              });
            }
          } else {
            const errorText = await serpResponse.text();
            console.error(`❌ [SERPAPI] Erro ${serpStatus}:`, errorText.substring(0, 200));
          }
          
          await new Promise(r => setTimeout(r, 300));
        }
        
        console.log(`✅ [SERPAPI] Total: ${leads.length} leads`);
      } catch (serpError) {
        console.error("❌ [SERPAPI] Exception:", serpError);
      }
    } else {
      console.warn("⚠️ SERPAPI_KEY não configurada");
    }

    // ==== MÉTODO 2: GOOGLE CUSTOM SEARCH ====
    if (GOOGLE_API_KEY && GOOGLE_CX && leads.length < 15) {
      console.log("🔍 [GOOGLE CSE] Iniciando busca...");
      
      try {
        const googleQuery = `${profissao} ${cidade} LinkedIn contato`;
        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(googleQuery)}&num=10`;
        
        const googleResponse = await fetch(googleUrl);
        const googleStatus = googleResponse.status;
        
        console.log(`📡 [GOOGLE CSE] Status: ${googleStatus}`);
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          const items = googleData.items || [];
          
          console.log(`📊 [GOOGLE CSE] Resultados: ${items.length}`);
          
          for (const item of items) {
            const isLinkedIn = item.link?.includes('linkedin.com/in/');
            
            let nome = '';
            if (isLinkedIn) {
              nome = item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || '';
            } else {
              const nomeMatch = item.snippet?.match(/(?:Dr\.|Dra\.)?\s*([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)+)/);
              nome = nomeMatch?.[1] || '';
            }

            if (!nome || nome.length < 3) continue;
            
            const exists = leads.find(l => l.nome_completo?.toLowerCase() === nome.toLowerCase());
            if (exists) continue;

            leads.push({
              nome_completo: nome,
              profissao: profissao,
              cidade: cidade,
              estado: estado,
              linkedin_url: isLinkedIn ? item.link : null,
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
        } else {
          const errorText = await googleResponse.text();
          console.error(`❌ [GOOGLE CSE] Erro ${googleStatus}:`, errorText.substring(0, 200));
        }
        
        console.log(`✅ [GOOGLE CSE] Total agora: ${leads.length} leads`);
      } catch (googleError) {
        console.error("❌ [GOOGLE CSE] Exception:", googleError);
      }
    }

    // ==== MÉTODO 3: APIFY GOOGLE SCRAPER (fallback) ====
    if (APIFY_TOKEN && leads.length < 10) {
      console.log("🔍 [APIFY] Iniciando busca...");
      
      try {
        const apifyResponse = await fetch('https://api.apify.com/v2/acts/apify~google-search-scraper/runs?waitForFinish=60', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`
          },
          body: JSON.stringify({
            queries: `site:linkedin.com/in "${profissao}" "${cidade}"`,
            maxPagesPerQuery: 1,
            resultsPerPage: 15,
            languageCode: "pt",
            countryCode: "br"
          })
        });

        console.log(`📡 [APIFY] Status: ${apifyResponse.status}`);

        if (apifyResponse.ok) {
          const runData = await apifyResponse.json();
          const runId = runData.data?.id;

          if (runId) {
            console.log(`✅ [APIFY] Run: ${runId}`);
            
            const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
              headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
            });

            if (resultsResponse.ok) {
              const apifyResults = await resultsResponse.json();
              console.log(`📊 [APIFY] Resultados brutos: ${apifyResults.length}`);

              for (const result of apifyResults) {
                const organicResults = result.organicResults || [];
                
                for (const item of organicResults) {
                  if (!item.url?.includes('linkedin.com/in/')) continue;
                  
                  const nome = item.title?.split(' - ')[0]?.split(' | ')[0]?.trim();
                  if (!nome || nome.length < 3) continue;
                  
                  const exists = leads.find(l => l.nome_completo?.toLowerCase() === nome.toLowerCase());
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
                    query_usada: `site:linkedin.com/in "${profissao}" "${cidade}"`,
                    pipeline_status: 'descoberto',
                    score: 55,
                    campanha_id,
                    user_id: icp.user_id
                  });
                }
              }
            }
          }
        } else {
          const errorText = await apifyResponse.text();
          console.error(`❌ [APIFY] Erro:`, errorText.substring(0, 200));
        }
        
        console.log(`✅ [APIFY] Total agora: ${leads.length} leads`);
      } catch (apifyError) {
        console.error("❌ [APIFY] Exception:", apifyError);
      }
    }

    console.log(`📊 Total final: ${leads.length} leads`);

    if (leads.length === 0) {
      console.warn("⚠️ Nenhum lead encontrado");
      return new Response(
        JSON.stringify({
          success: false,
          leads_encontrados: 0,
          message: "Nenhum lead encontrado. Verifique os logs para detalhes sobre as APIs."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ==== SALVAR LEADS ====
    console.log(`💾 Salvando ${leads.length} leads...`);

    const uniqueLeads = leads.filter((lead, index, self) =>
      index === self.findIndex(l => l.nome_completo?.toLowerCase() === lead.nome_completo?.toLowerCase())
    );

    const { error: insertError } = await supabase
      .from("leads_b2c")
      .insert(uniqueLeads);
    
    if (insertError) {
      console.error("❌ Erro ao salvar:", insertError);
      throw insertError;
    }

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

    console.log(`🎉 Concluído: ${uniqueLeads.length} leads salvos!`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: uniqueLeads.length,
        message: `${uniqueLeads.length} leads encontrados!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ ERRO GERAL:", errorMessage);
    
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
