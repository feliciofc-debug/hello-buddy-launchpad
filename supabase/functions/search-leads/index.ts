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

    // ==== BUSCAR LEADS REAIS VIA APIFY LINKEDIN ====
    const APIFY_TOKEN = Deno.env.get('APIFY_API_KEY');
    
    if (!APIFY_TOKEN) {
      console.error("❌ APIFY_API_KEY não configurada");
      throw new Error("APIFY_API_KEY não configurada. Configure no Supabase.");
    }

    console.log("🔗 Iniciando busca no LinkedIn via Apify...");

    const searchQuery = `${profissao} ${cidade}`;
    const maxResults = 30;

    // Usar actor válido: harvestapi/linkedin-profile-search
    const runResponse = await fetch('https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/runs?waitForFinish=300', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        currentJobTitles: [profissao],
        locations: [`${cidade}, ${estado}, Brazil`],
        startPage: 1,
        takePages: 3
      })
    });

    let linkedinResults: any[] = [];

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.warn('⚠️ LinkedIn via harvestapi falhou:', runResponse.status, errorText);
      
      // Tentar actor alternativo: powerai/linkedin-peoples-search-scraper
      console.log("🔄 Tentando actor alternativo...");
      
      const altResponse = await fetch('https://api.apify.com/v2/acts/powerai~linkedin-peoples-search-scraper/runs?waitForFinish=300', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
          title: profissao,
          industry: "healthcare",
          maxResults: maxResults
        })
      });

      if (altResponse.ok) {
        const altRunData = await altResponse.json();
        const altRunId = altRunData.data?.id;
        
        if (altRunId) {
          const altResultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${altRunId}/dataset/items`, {
            headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
          });
          linkedinResults = await altResultsResponse.json();
          console.log(`📊 LinkedIn (alt): ${linkedinResults.length} perfis encontrados`);
        }
      }
    } else {
      const runData = await runResponse.json();
      const runId = runData.data?.id;

      console.log(`✅ Run Apify iniciada: ${runId}`);

      if (runId) {
        // Buscar resultados do dataset
        const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
          headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
        });

        linkedinResults = await resultsResponse.json();
        console.log(`📊 LinkedIn: ${linkedinResults.length} perfis encontrados`);
      }
    }

    // ==== BUSCAR TAMBÉM NO INSTAGRAM (opcional) ====
    let instagramResults: any[] = [];
    
    try {
      console.log("📷 Buscando no Instagram via Apify...");
      
      // Actor válido do Instagram
      const igResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-scraper/runs?waitForFinish=180', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
          searchType: "hashtag",
          search: [`${profissao}${cidade.replace(/\s/g, '')}`],
          resultsLimit: 20
        })
      });

      if (igResponse.ok) {
        const igRunData = await igResponse.json();
        const igRunId = igRunData.data?.id;
        
        if (igRunId) {
          const igResultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${igRunId}/dataset/items`, {
            headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
          });
          instagramResults = await igResultsResponse.json();
          console.log(`📷 Instagram: ${instagramResults.length} perfis encontrados`);
        }
      }
    } catch (igError) {
      console.warn("⚠️ Busca Instagram falhou (continuando com LinkedIn):", igError);
    }

    // ==== PROCESSAR E UNIFICAR RESULTADOS ====
    const leads: any[] = [];

    // Processar LinkedIn
    for (const profile of linkedinResults) {
      const lead = {
        nome_completo: profile.fullName || profile.name || profile.firstName + ' ' + profile.lastName || 'Nome não disponível',
        profissao: profile.headline || profile.title || profile.currentJobTitle || profissao,
        especialidade: profile.headline || null,
        cidade: profile.location?.split(',')[0]?.trim() || profile.city || cidade,
        estado: profile.location?.split(',')[1]?.trim() || profile.state || estado,
        linkedin_url: profile.profileUrl || profile.url || profile.linkedinUrl || profile.profileLink,
        linkedin_id: profile.publicIdentifier || profile.profileId || profile.id,
        email: profile.email || null,
        telefone: profile.phoneNumber || profile.phone || null,
        foto_url: profile.profilePicture || profile.photoUrl || profile.avatar,
        fonte: 'linkedin_apify',
        fonte_url: profile.profileUrl || profile.url || profile.profileLink,
        fonte_snippet: `${profile.headline || profissao} em ${profile.location || cidade}`,
        query_usada: searchQuery,
        pipeline_status: 'descoberto',
        score: 50,
        campanha_id,
        user_id: icp.user_id
      };

      // Só adicionar se tiver dados válidos
      if (lead.nome_completo && lead.nome_completo !== 'Nome não disponível') {
        leads.push(lead);
      }
    }

    // Processar Instagram
    for (const profile of instagramResults) {
      if (!profile.isBusinessAccount && !profile.isVerified && (profile.followersCount || 0) < 1000) {
        continue;
      }

      const existingLead = leads.find(l => 
        l.nome_completo.toLowerCase() === (profile.fullName || profile.username || '').toLowerCase()
      );

      if (existingLead) {
        existingLead.instagram_username = profile.username;
        existingLead.instagram_seguidores = profile.followersCount;
        existingLead.email = existingLead.email || profile.businessEmail || profile.publicEmail;
        existingLead.telefone = existingLead.telefone || profile.businessPhoneNumber || profile.publicPhoneNumber;
        existingLead.score = (existingLead.score || 50) + 10;
      } else {
        leads.push({
          nome_completo: profile.fullName || profile.username,
          profissao: profile.businessCategoryName || profissao,
          cidade: profile.businessAddressJson?.city || cidade,
          estado: estado,
          instagram_username: profile.username,
          instagram_seguidores: profile.followersCount,
          email: profile.businessEmail || profile.publicEmail,
          telefone: profile.businessPhoneNumber || profile.publicPhoneNumber,
          site_url: profile.externalUrl,
          fonte: 'instagram_apify',
          fonte_url: `https://instagram.com/${profile.username}`,
          fonte_snippet: profile.biography?.substring(0, 200),
          query_usada: searchQuery,
          pipeline_status: 'descoberto',
          score: 40,
          campanha_id,
          user_id: icp.user_id
        });
      }
    }

    console.log(`✅ Total de leads processados: ${leads.length}`);

    if (leads.length === 0) {
      console.warn("⚠️ Nenhum lead encontrado");
      return new Response(
        JSON.stringify({
          success: false,
          leads_encontrados: 0,
          message: "Nenhum lead encontrado. Tente ajustar os parâmetros de busca ou verifique sua API key do Apify."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ==== SALVAR LEADS NO BANCO ====
    console.log(`💾 Salvando ${leads.length} leads REAIS no banco...`);

    const { error: insertError } = await supabase
      .from("leads_b2c")
      .insert(leads);
    
    if (insertError) {
      console.error("❌ Erro ao salvar:", insertError);
      throw insertError;
    }

    // Atualizar estatísticas da campanha
    await supabase
      .from("campanhas_prospeccao")
      .update({
        stats: {
          descobertos: leads.length,
          enriquecidos: 0,
          qualificados: 0,
          enviados: 0,
          responderam: 0,
          convertidos: 0
        }
      })
      .eq("id", campanha_id);

    console.log(`🎉 Busca REAL concluída: ${leads.length} leads salvos!`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leads.length,
        leads_linkedin: linkedinResults.length,
        leads_instagram: instagramResults.length,
        message: `${leads.length} leads REAIS encontrados via LinkedIn e Instagram!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ ERRO:", errorMessage);
    console.error("❌ Stack:", error instanceof Error ? error.stack : '');
    
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
