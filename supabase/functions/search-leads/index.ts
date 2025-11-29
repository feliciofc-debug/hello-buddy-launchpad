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
    const cidade = icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.b2c_config?.estados?.[0] || "RJ";

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

    // Chamar Apify LinkedIn Scraper
    const runResponse = await fetch('https://api.apify.com/v2/acts/bebity~linkedin-people-search/runs?waitForFinish=300', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        searchTerms: [searchQuery],
        location: 'Brazil',
        maxResults: maxResults,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      })
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('❌ Erro Apify LinkedIn:', errorText);
      throw new Error(`Erro Apify: ${runResponse.status} - ${errorText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    console.log(`✅ Run Apify iniciada: ${runId}`);

    if (!runId) {
      throw new Error('Não foi possível obter ID da execução Apify');
    }

    // Buscar resultados do dataset
    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });

    const linkedinResults = await resultsResponse.json();
    console.log(`📊 LinkedIn: ${linkedinResults.length} perfis encontrados`);

    // ==== BUSCAR TAMBÉM NO INSTAGRAM (opcional) ====
    let instagramResults: any[] = [];
    
    try {
      console.log("📷 Buscando no Instagram via Apify...");
      
      const igResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?waitForFinish=180', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APIFY_TOKEN}`
        },
        body: JSON.stringify({
          search: `${profissao} ${cidade}`,
          searchType: 'hashtag',
          resultsLimit: 20,
          proxy: { useApifyProxy: true }
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
        nome_completo: profile.fullName || profile.name || 'Nome não disponível',
        profissao: profile.headline || profile.title || profissao,
        especialidade: profile.headline || null,
        cidade: profile.location?.split(',')[0]?.trim() || cidade,
        estado: profile.location?.split(',')[1]?.trim() || estado,
        linkedin_url: profile.profileUrl || profile.url || profile.linkedinUrl,
        linkedin_id: profile.publicIdentifier || profile.profileId,
        email: profile.email || null,
        telefone: profile.phoneNumber || profile.phone || null,
        foto_url: profile.profilePicture || profile.photoUrl,
        fonte: 'linkedin_apify',
        fonte_url: profile.profileUrl || profile.url,
        fonte_snippet: `${profile.headline || profissao} em ${profile.location || cidade}`,
        query_usada: searchQuery,
        pipeline_status: 'descoberto',
        score: 50, // Score base para leads reais
        campanha_id,
        user_id: icp.user_id
      };

      // Só adicionar se tiver LinkedIn URL válido
      if (lead.linkedin_url) {
        leads.push(lead);
      }
    }

    // Processar Instagram (merge com LinkedIn se mesmo nome)
    for (const profile of instagramResults) {
      // Verificar se é conta business ou verificada
      if (!profile.isBusinessAccount && !profile.isVerified && (profile.followersCount || 0) < 1000) {
        continue;
      }

      // Verificar se já existe pelo nome
      const existingLead = leads.find(l => 
        l.nome_completo.toLowerCase() === (profile.fullName || profile.username || '').toLowerCase()
      );

      if (existingLead) {
        // Merge - adicionar dados do Instagram
        existingLead.instagram_username = profile.username;
        existingLead.instagram_seguidores = profile.followersCount;
        existingLead.email = existingLead.email || profile.businessEmail || profile.publicEmail;
        existingLead.telefone = existingLead.telefone || profile.businessPhoneNumber || profile.publicPhoneNumber;
        existingLead.score = (existingLead.score || 50) + 10; // Bonus por ter Instagram
      } else {
        // Novo lead apenas do Instagram
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
          score: 40, // Score base para leads só do Instagram
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
          message: "Nenhum lead encontrado. Tente ajustar os parâmetros de busca."
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
          leads_descobertos: leads.length,
          ultima_busca: new Date().toISOString(),
          fonte: 'apify_linkedin_instagram'
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
