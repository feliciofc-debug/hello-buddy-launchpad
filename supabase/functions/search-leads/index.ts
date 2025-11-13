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
    
    // 1. Buscar ICP
    const { data: icp, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError) throw new Error(`ICP não encontrado: ${icpError.message}`);
    
    console.log("✅ ICP encontrado:", icp.nome);
    
    // TEMPORÁRIO: Dados fake para teste rápido
    console.log("⚠️ MODO TESTE - Gerando dados de exemplo");
    
    const leadsFake = [
      {
        campanha_id: campanha_id,
        user_id: icp.user_id,
        nome_completo: "Dr. Carlos Eduardo Santos",
        profissao: "Médico Cardiologista",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        email: "carlos.santos@exemplo.com",
        telefone: "(21) 98765-4321",
        linkedin_url: "https://linkedin.com/in/dr-carlos-santos",
        fonte: "serpapi_teste",
        fonte_url: "https://linkedin.com/in/dr-carlos-santos",
        fonte_snippet: "Médico Cardiologista com mais de 15 anos de experiência",
        query_usada: "médico cardiologista Rio de Janeiro",
        tipo: "b2c",
        pipeline_status: "descoberto"
      },
      {
        campanha_id: campanha_id,
        user_id: icp.user_id,
        nome_completo: "Dra. Ana Paula Oliveira",
        profissao: "Médica Dermatologista",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        email: "ana.oliveira@exemplo.com",
        telefone: "(21) 99876-5432",
        linkedin_url: "https://linkedin.com/in/dra-ana-oliveira",
        instagram_username: "draana",
        fonte: "serpapi_teste",
        fonte_url: "https://instagram.com/draana",
        fonte_snippet: "Dermatologista especialista em estética",
        query_usada: "médico dermatologista Rio de Janeiro",
        tipo: "b2c",
        pipeline_status: "descoberto"
      },
      {
        campanha_id: campanha_id,
        user_id: icp.user_id,
        nome_completo: "Dr. Roberto Mendes Silva",
        profissao: "Médico Ortopedista",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        telefone: "(21) 97654-3210",
        linkedin_url: "https://linkedin.com/in/dr-roberto-mendes",
        fonte: "serpapi_teste",
        fonte_url: "https://linkedin.com/in/dr-roberto-mendes",
        fonte_snippet: "Ortopedista e Traumatologista - Consultório em Ipanema",
        query_usada: "médico ortopedista Rio de Janeiro",
        tipo: "b2c",
        pipeline_status: "descoberto"
      },
      {
        campanha_id: campanha_id,
        user_id: icp.user_id,
        nome_completo: "Dra. Marina Costa Lima",
        profissao: "Médica Pediatra",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        email: "marina.lima@exemplo.com",
        telefone: "(21) 96543-2109",
        instagram_username: "dramarina",
        fonte: "serpapi_teste",
        fonte_url: "https://instagram.com/dramarina",
        fonte_snippet: "Pediatra dedicada ao cuidado infantil",
        query_usada: "médico pediatra Rio de Janeiro",
        tipo: "b2c",
        pipeline_status: "descoberto"
      },
      {
        campanha_id: campanha_id,
        user_id: icp.user_id,
        nome_completo: "Dr. Fernando Alves Pereira",
        profissao: "Médico Neurologista",
        cidade: "Rio de Janeiro",
        estado: "RJ",
        email: "fernando.pereira@exemplo.com",
        telefone: "(21) 95432-1098",
        linkedin_url: "https://linkedin.com/in/dr-fernando-pereira",
        fonte: "serpapi_teste",
        fonte_url: "https://linkedin.com/in/dr-fernando-pereira",
        fonte_snippet: "Neurologista - Especialista em doenças neurodegenerativas",
        query_usada: "médico neurologista Rio de Janeiro",
        tipo: "b2c",
        pipeline_status: "descoberto"
      }
    ];
    
    console.log(`💾 Salvando ${leadsFake.length} leads de teste...`);
    
    const { error: insertError } = await supabase
      .from("leads_b2c")
      .insert(leadsFake);
    
    if (insertError) {
      console.error("❌ Erro ao salvar:", insertError);
      throw insertError;
    }
    
    console.log(`🎉 Concluído! ${leadsFake.length} leads de teste salvos`);
    
    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leadsFake.length,
        message: `✅ ${leadsFake.length} leads de teste gerados! (Versão de demonstração)`
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
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
