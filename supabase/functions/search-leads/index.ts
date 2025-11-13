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

  try {
    console.log("🚀 Iniciando busca...");
    
    const { campanha_id, icp_config_id } = await req.json();
    console.log("📋 IDs:", { campanha_id, icp_config_id });
    
    // Validar API key
    if (!SERPAPI_KEY) {
      console.error("❌ SERPAPI_KEY não configurada");
      throw new Error("SERPAPI_KEY não configurada. Configure em Settings > Secrets");
    }
    
    // 1. Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError) throw new Error(`ICP não encontrado: ${icpError.message}`);
    
    console.log("✅ ICP encontrado:", icp.nome);
    
    if (!icp) throw new Error("ICP não encontrado");

    // Extrair dados do ICP
    const profissao = icp.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icp.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icp.b2c_config?.estados?.[0] || "RJ";

    console.log("🔍 Buscando:", { profissao, cidade, estado });

    // Buscar no SerpAPI
    const serpUrl = new URL("https://serpapi.com/search");
    serpUrl.searchParams.append("api_key", SERPAPI_KEY!);
    serpUrl.searchParams.append("engine", "google");
    serpUrl.searchParams.append("q", `${profissao} ${cidade} ${estado} site:linkedin.com/in`);
    serpUrl.searchParams.append("num", "10");
    serpUrl.searchParams.append("gl", "br");
    serpUrl.searchParams.append("hl", "pt-br");

    console.log("📡 Chamando SerpAPI...");
    console.log("🔗 URL:", serpUrl.toString());

    const serpResponse = await fetch(serpUrl.toString());

    if (!serpResponse.ok) {
      const errorText = await serpResponse.text();
      console.error(`❌ SerpAPI error ${serpResponse.status}:`, errorText);
      throw new Error(`SerpAPI error: ${serpResponse.status} - ${errorText}`);
    }

    const serpData = await serpResponse.json();
    console.log("📦 SerpAPI response:", JSON.stringify(serpData, null, 2));
    const results = serpData.organic_results || [];

    console.log(`📊 SerpAPI retornou ${results.length} resultados`);

    // Processar resultados
    const leads = [];

    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i];
      
      // Extrair nome do título
      let nome = result.title;
      
      // Limpar nome (remover " - LinkedIn", " | LinkedIn", etc)
      nome = nome.split('|')[0].split('-')[0].split('—')[0].trim();
      
      // Pular se for muito curto ou contém palavras inválidas
      if (nome.length < 5) continue;
      if (nome.toLowerCase().includes('vaga')) continue;
      if (nome.toLowerCase().includes('linkedin')) continue;
      
      // Extrair profissão do snippet
      let profissaoExtraida = profissao;
      const profMatch = result.snippet?.match(/(Médico|Médica|Dentista|Advogado|Psicólogo|Nutricionista)[a-zà-ú\s]*/i);
      if (profMatch) {
        profissaoExtraida = profMatch[0].trim();
      }
      
      // Extrair email e telefone do snippet
      const emailMatch = result.snippet?.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      const telMatch = result.snippet?.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/);
      
      leads.push({
        campanha_id,
        user_id: icp.user_id,
        nome_completo: nome,
        profissao: profissaoExtraida,
        cidade,
        estado,
        email: emailMatch ? emailMatch[0] : null,
        telefone: telMatch ? telMatch[0] : null,
        linkedin_url: result.link,
        fonte: 'serpapi_linkedin',
        fonte_url: result.link,
        fonte_snippet: result.snippet?.substring(0, 200),
        query_usada: `${profissao} ${cidade}`,
        pipeline_status: 'descoberto'
      });
      
      console.log(`✅ Lead ${i+1}: ${nome}`);
    }

    console.log(`💾 Salvando ${leads.length} leads...`);

    // Salvar leads
    if (leads.length > 0) {
      const { error: insertError } = await supabase
        .from("leads_b2c")
        .insert(leads);
      
      if (insertError) {
        console.error("❌ Erro ao salvar:", insertError);
        throw insertError;
      }
    }

    console.log(`🎉 Busca concluída: ${leads.length} leads salvos`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leads.length,
        message: `${leads.length} leads REAIS encontrados!`
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
        details: error instanceof Error ? error.stack : '',
        hint: "Verifique se a SERPAPI_KEY está configurada corretamente em Settings > Secrets"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
