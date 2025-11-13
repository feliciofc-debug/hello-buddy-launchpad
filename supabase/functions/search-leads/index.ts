import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Timeout de 50 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  try {
    console.log("🚀 Iniciando busca...");
    
    const { campanha_id, icp_config_id } = await req.json();
    console.log("📋 IDs:", { campanha_id, icp_config_id });
    
    // 1. Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError) throw new Error(`ICP não encontrado: ${icpError.message}`);
    
    console.log("✅ ICP encontrado:", icp.nome);
    
    // 2. Montar query
    const profissao = icp.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.b2c_config?.estados?.[0] || "RJ";
    
    console.log("🔍 Buscando:", { profissao, cidade, estado });
    
    // 3. Buscar no SerpAPI (SIMPLIFICADO - apenas 10 resultados)
    const serpUrl = new URL("https://serpapi.com/search");
    serpUrl.searchParams.append("api_key", SERPAPI_KEY!);
    serpUrl.searchParams.append("engine", "google");
    serpUrl.searchParams.append("q", `${profissao} ${cidade} ${estado} site:linkedin.com/in`);
    serpUrl.searchParams.append("num", "10");
    serpUrl.searchParams.append("gl", "br");
    
    console.log("📡 Chamando SerpAPI...");
    
    const serpResponse = await fetch(serpUrl.toString(), { signal: controller.signal });
    
    if (!serpResponse.ok) {
      throw new Error(`SerpAPI error: ${serpResponse.status}`);
    }
    
    const serpData = await serpResponse.json();
    
    console.log("📊 SerpAPI retornou:", serpData.organic_results?.length || 0, "resultados");
    
    // 4. Processar resultados (SIMPLIFICADO)
    const leads = [];
    const results = serpData.organic_results || [];
    
    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i];
      
      // Extrair nome simples
      let nome = result.title.split('|')[0].split('-')[0].trim();
      
      // Pular se for vaga ou nome muito curto
      if (nome.toLowerCase().includes('vaga')) continue;
      if (nome.length < 5) continue;
      
      leads.push({
        campanha_id,
        user_id: icp.user_id,
        nome_completo: nome,
        profissao,
        cidade,
        estado,
        linkedin_url: result.link,
        fonte: 'serpapi',
        fonte_url: result.link,
        fonte_snippet: result.snippet?.substring(0, 200),
        query_usada: `${profissao} ${cidade}`,
        tipo: 'b2c',
        pipeline_status: 'descoberto'
      });
      
      console.log(`✅ Lead ${i+1}: ${nome}`);
    }
    
    console.log(`💾 Salvando ${leads.length} leads...`);
    
    // 5. Salvar no banco
    if (leads.length > 0) {
      const { error: insertError } = await supabase
        .from("leads_b2c")
        .insert(leads);
      
      if (insertError) {
        console.error("❌ Erro ao salvar:", insertError);
        throw insertError;
      }
    }
    
    console.log(`🎉 Concluído! ${leads.length} leads salvos`);
    
    clearTimeout(timeoutId);
    
    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leads.length,
        message: `${leads.length} leads encontrados!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ ERRO:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
