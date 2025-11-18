import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_ANON_KEY") || ""
);

interface EnrichRequest {
  lead_id: string;
  lead_tipo: "b2c" | "b2b";
}

// ===============================
// SERVIÇOS DE ENRIQUECIMENTO
// ===============================

// 1. Buscar LinkedIn via Google Custom Search
async function findLinkedIn(nome: string, profissao?: string): Promise<string | null> {
  try {
    const query = profissao 
      ? `${nome} ${profissao} site:linkedin.com/in`
      : `${nome} site:linkedin.com/in`;
    
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${Deno.env.get("GOOGLE_API_KEY")}&cx=${Deno.env.get("GOOGLE_CX")}&q=${encodeURIComponent(query)}`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const linkedinUrl = data.items[0].link;
      return linkedinUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao buscar LinkedIn:", error);
    return null;
  }
}

// 2. Buscar Instagram
async function findInstagram(nome: string, cidade?: string): Promise<string | null> {
  try {
    const query = cidade 
      ? `${nome} ${cidade} site:instagram.com`
      : `${nome} site:instagram.com`;
    
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${Deno.env.get("GOOGLE_API_KEY")}&cx=${Deno.env.get("GOOGLE_CX")}&q=${encodeURIComponent(query)}`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const instagramUrl = data.items[0].link;
      const match = instagramUrl.match(/instagram\.com\/([^\/\?]+)/);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao buscar Instagram:", error);
    return null;
  }
}

// 3. Validar e formatar telefone/WhatsApp
function formatPhoneNumber(phone: string): { telefone: string; whatsapp: string | null } {
  const clean = phone.replace(/\D/g, "");
  const isCelular = clean.length === 11 && clean[2] === "9";
  
  return {
    telefone: phone,
    whatsapp: isCelular ? clean : null,
  };
}

// 4. Buscar email
async function findEmail(nome: string, profissao?: string, cidade?: string): Promise<string | null> {
  try {
    const query = `${nome} email ${profissao || ""} ${cidade || ""}`;
    
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${Deno.env.get("GOOGLE_API_KEY")}&cx=${Deno.env.get("GOOGLE_CX")}&q=${encodeURIComponent(query)}`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const snippet = data.items[0].snippet;
      const emailMatch = snippet.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao buscar email:", error);
    return null;
  }
}

// 5. Enriquecer dados de empresa via CNPJ
async function enrichCNPJ(cnpj: string): Promise<any> {
  try {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      capital_social: data.capital_social,
      situacao: data.situacao_cadastral,
      data_constituicao: data.data_inicio_atividade,
      natureza_juridica: data.natureza_juridica,
      porte: data.porte,
      endereco: `${data.logradouro}, ${data.numero} - ${data.bairro}`,
      cidade: data.municipio,
      estado: data.uf,
      telefone: data.ddd_telefone_1,
      email: data.email,
      setor: data.cnae_fiscal_descricao,
    };
  } catch (error) {
    console.error("Erro ao enriquecer CNPJ:", error);
    return null;
  }
}

// 6. Detectar sinais de poder aquisitivo (B2C)
function detectPowerSignals(enrichmentData: any): string[] {
  const signals: string[] = [];
  
  if (enrichmentData.linkedin_url) {
    signals.push("Presença no LinkedIn");
  }
  
  if (enrichmentData.instagram_username) {
    signals.push("Ativo no Instagram");
  }
  
  return signals;
}

// ===============================
// FUNÇÃO PRINCIPAL DE ENRIQUECIMENTO
// ===============================

async function enrichLeadB2C(leadId: string) {
  console.log("🔍 Enriquecendo lead B2C:", leadId);
  
  const { data: lead, error } = await supabase
    .from("leads_b2c")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  
  if (error || !lead) {
    throw new Error("Lead não encontrado");
  }
  
  const enrichment: any = {};
  
  if (!lead.linkedin_url) {
    const linkedin = await findLinkedIn(lead.nome_completo, lead.profissao);
    if (linkedin) {
      enrichment.linkedin_url = linkedin;
      console.log("✅ LinkedIn encontrado:", linkedin);
    }
  }
  
  if (!lead.instagram_username) {
    const instagram = await findInstagram(lead.nome_completo, lead.cidade);
    if (instagram) {
      enrichment.instagram_username = instagram;
      console.log("✅ Instagram encontrado:", instagram);
    }
  }
  
  if (!lead.email) {
    const email = await findEmail(lead.nome_completo, lead.profissao, lead.cidade);
    if (email) {
      enrichment.email = email;
      console.log("✅ Email encontrado:", email);
    }
  }
  
  if (lead.telefone && !lead.whatsapp) {
    const phone = formatPhoneNumber(lead.telefone);
    if (phone.whatsapp) {
      enrichment.whatsapp = phone.whatsapp;
      console.log("✅ WhatsApp validado:", phone.whatsapp);
    }
  }
  
  const signals = detectPowerSignals({ ...lead, ...enrichment });
  if (signals.length > 0) {
    enrichment.sinais_poder_aquisitivo = signals;
  }
  
  const { error: updateError } = await supabase
    .from("leads_b2c")
    .update({
      ...enrichment,
      enrichment_data: enrichment,
      enriched_at: new Date().toISOString(),
      pipeline_status: "enriquecido",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  
  if (updateError) {
    throw updateError;
  }
  
  console.log("✅ Lead B2C enriquecido com sucesso");
  
  return {
    lead_id: leadId,
    enrichment,
    status: "success",
  };
}

async function enrichLeadB2B(leadId: string) {
  console.log("🔍 Enriquecendo lead B2B:", leadId);
  
  const { data: lead, error } = await supabase
    .from("leads_b2b")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  
  if (error || !lead) {
    throw new Error("Lead não encontrado");
  }
  
  const cnpjData = await enrichCNPJ(lead.cnpj);
  
  if (!cnpjData) {
    throw new Error("Não foi possível enriquecer CNPJ");
  }
  
  let decisor = null;
  if (cnpjData.razao_social) {
    const linkedin = await findLinkedIn(
      `CEO ${cnpjData.razao_social}`,
      "CEO"
    );
    if (linkedin) {
      decisor = {
        linkedin_url: linkedin,
        cargo: "CEO",
      };
      console.log("✅ Decisor encontrado no LinkedIn");
    }
  }
  
  const { error: updateError } = await supabase
    .from("leads_b2b")
    .update({
      ...cnpjData,
      contato_linkedin: decisor?.linkedin_url,
      contato_cargo: decisor?.cargo,
      enrichment_data: { ...cnpjData, decisor },
      enriched_at: new Date().toISOString(),
      pipeline_status: "enriquecido",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  
  if (updateError) {
    throw updateError;
  }
  
  console.log("✅ Lead B2B enriquecido com sucesso");
  
  return {
    lead_id: leadId,
    enrichment: { ...cnpjData, decisor },
    status: "success",
  };
}

// ===============================
// HANDLER
// ===============================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  
  try {
    const { lead_id, lead_tipo }: EnrichRequest = await req.json();
    
    console.log(`🚀 Iniciando enriquecimento: ${lead_tipo.toUpperCase()} - ${lead_id}`);
    
    let result;
    if (lead_tipo === "b2c") {
      result = await enrichLeadB2C(lead_id);
    } else if (lead_tipo === "b2b") {
      result = await enrichLeadB2B(lead_id);
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Erro ao enriquecer lead:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        status: "failed"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
