import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_ANON_KEY") || ""
);

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");

interface SearchRequest {
  campanha_id: string;
  icp_config_id: string;
}

async function searchWithSerpAPI(query: string, location: string, num: number = 20) {
  console.log("🔍 Buscando via SerpAPI:", { query, location, num });
  
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY não configurada");
  }
  
  const url = new URL("https://serpapi.com/search");
  url.searchParams.append("api_key", SERPAPI_KEY);
  url.searchParams.append("engine", "google");
  url.searchParams.append("q", `${query} ${location} (site:linkedin.com/in OR site:doctoralia.com.br OR site:instagram.com)`);
  url.searchParams.append("num", num.toString());
  url.searchParams.append("gl", "br");
  url.searchParams.append("hl", "pt-br");
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status}`);
  }
  
  const data = await response.json();
  
  console.log("📊 SerpAPI retornou:", {
    total: data.organic_results?.length || 0,
    credits_left: data.search_metadata?.total_credits_left
  });
  
  return data.organic_results || [];
}

function extractLeadFromResult(result: any, query: string, location: string): any {
  const { title, link, snippet } = result;
  
  let nome = title;
  
  // Extrair nome do LinkedIn
  if (link.includes('linkedin.com/in')) {
    const match = title.match(/^([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+){1,4})/);
    if (match) {
      nome = match[1];
    }
  }
  
  // Extrair nome do Doctoralia
  if (link.includes('doctoralia.com.br')) {
    const match = title.match(/(Dr\.|Dra\.)\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+){1,4})/);
    if (match) {
      nome = match[0];
    }
  }
  
  let profissao = query;
  const profissaoMatch = snippet.match(/(Médico|Médica|Dentista|Advogado|Advogada|Psicólogo|Psicóloga|Nutricionista|Fisioterapeuta)(?:\s+([A-Za-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþß]+))?/i);
  if (profissaoMatch) {
    profissao = profissaoMatch[0];
  }
  
  let especialidade = null;
  const espMatch = snippet.match(/(Cardiologia|Dermatologia|Ortopedia|Pediatria|Neurologia|Clínica Geral|Odontologia|Psicologia|Nutrição|Fisioterapia)/i);
  if (espMatch) {
    especialidade = espMatch[0];
  }
  
  const emailMatch = snippet.match(/[\w\.-]+@[\w\.-]+\.\w+/);
  const telefoneMatch = snippet.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/);
  
  const cidade = location.split(',')[0]?.trim() || '';
  const estado = location.split(',')[1]?.trim() || 'RJ';
  
  return {
    nome_completo: nome.trim(),
    profissao: profissao.trim(),
    especialidade: especialidade?.trim() || null,
    cidade,
    estado,
    email: emailMatch ? emailMatch[0] : null,
    telefone: telefoneMatch ? telefoneMatch[0] : null,
    linkedin_url: link.includes('linkedin.com') ? link : null,
    instagram_username: link.includes('instagram.com') ? link.split('/').filter(Boolean).pop() : null,
    fonte: link.includes('linkedin') ? 'linkedin' : link.includes('doctoralia') ? 'doctoralia' : 'google',
    fonte_url: link,
    fonte_snippet: snippet.substring(0, 200),
    query_usada: query,
    tipo: 'b2c',
    pipeline_status: 'descoberto'
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  
  try {
    const { campanha_id, icp_config_id }: SearchRequest = await req.json();
    
    console.log("🚀 Iniciando busca de leads", { campanha_id, icp_config_id });
    
    const { data: icpConfig, error: icpError } = await supabase
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();
    
    if (icpError || !icpConfig) {
      throw new Error("ICP config não encontrado");
    }
    
    const profissao = icpConfig.b2c_config?.profissoes?.[0] || "médico";
    const cidade = icpConfig.b2c_config?.cidades?.[0] || "Rio de Janeiro";
    const estado = icpConfig.b2c_config?.estados?.[0] || "RJ";
    const location = `${cidade}, ${estado}`;
    
    const results = await searchWithSerpAPI(profissao, location, 20);
    
    console.log(`✅ Encontrados ${results.length} resultados brutos`);
    
    const leads = [];
    
    for (const result of results) {
      try {
        const lead = extractLeadFromResult(result, profissao, location);
        
        if (!lead.nome_completo || lead.nome_completo.length < 5) {
          console.log(`❌ Nome inválido: ${lead.nome_completo}`);
          continue;
        }
        
        if (lead.nome_completo.toLowerCase().includes('vaga')) {
          console.log(`❌ Rejeitado (vaga): ${lead.nome_completo}`);
          continue;
        }
        
        leads.push(lead);
        console.log(`✅ Lead válido: ${lead.nome_completo} - ${lead.profissao}`);
        
      } catch (error) {
        console.error("Erro ao processar resultado:", error);
      }
    }
    
    if (leads.length > 0) {
      const leadsToInsert = leads.map(lead => ({
        ...lead,
        campanha_id,
        user_id: icpConfig.user_id,
      }));
      
      const { error: insertError } = await supabase
        .from("leads_b2c")
        .insert(leadsToInsert);
      
      if (insertError) {
        console.error("Erro ao inserir leads:", insertError);
        throw insertError;
      }
    }
    
    console.log(`🎉 Busca concluída: ${leads.length} leads salvos`);
    
    return new Response(
      JSON.stringify({
        success: true,
        leads_encontrados: leads.length,
        leads: leads,
        message: `${leads.length} leads encontrados e salvos!`
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    console.error("❌ Erro na busca:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
