import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateLeadRequest {
  lead_data: {
    nome?: string;
    nome_completo?: string;
    profissao?: string;
    cnpj?: string;
    razao_social?: string;
    tipo: "b2c" | "b2b";
  };
  icp_config_id: string;
}

// Padrões para identificar estabelecimentos (não profissionais)
const ESTABELECIMENTOS_PATTERNS = [
  /clínica/i,
  /consultório/i,
  /hospital/i,
  /farmácia/i,
  /farmacia/i,
  /loja/i,
  /restaurante/i,
  /bar/i,
  /café/i,
  /escritório/i,
  /empresa/i,
  /ltda/i,
  /sa\b/i,
  /s\.a\./i,
  /eireli/i,
  /spa/i,
  /academia/i,
  /estúdio/i,
  /estudio/i,
];

// Validar se é um estabelecimento e não pessoa
function isEstabelecimento(nome: string): boolean {
  return ESTABELECIMENTOS_PATTERNS.some((pattern) => pattern.test(nome));
}

// Validar email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validar CNPJ
function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, "");
  return clean.length === 14;
}

// Validar nome (não deve ser muito curto ou muito longo)
function isValidNome(nome: string): boolean {
  const clean = nome.trim();
  return clean.length >= 3 && clean.length <= 100 && !clean.match(/^\d+$/);
}

async function validateB2C(
  leadData: any,
  icpConfig: any
): Promise<{ valid: boolean; motivos: string[] }> {
  const motivos: string[] = [];

  const nome = leadData.nome_completo || leadData.nome || "";

  // 1. Validar nome
  if (!isValidNome(nome)) {
    motivos.push("Nome inválido ou muito curto");
  }

  // 2. Validar que NÃO é estabelecimento
  if (isEstabelecimento(nome)) {
    motivos.push("Nome parece ser um estabelecimento, não pessoa");
  }

  // 3. Validar profissão
  if (!leadData.profissao || leadData.profissao.trim() === "") {
    motivos.push("Profissão não informada");
  }

  // 3.1. Validar que profissão não é estabelecimento
  if (leadData.profissao && isEstabelecimento(leadData.profissao)) {
    motivos.push("Profissão parece ser um estabelecimento");
  }

  // 4. Validar especialidade (se houver no ICP)
  if (
    icpConfig.b2c_config?.especialidades?.length > 0 &&
    leadData.especialidade
  ) {
    const especialidadeMatch = icpConfig.b2c_config.especialidades.some(
      (esp: string) =>
        leadData.especialidade.toLowerCase().includes(esp.toLowerCase())
    );
    if (!especialidadeMatch) {
      motivos.push(
        `Especialidade não está no ICP: ${leadData.especialidade}`
      );
    }
  }

  // 5. Validar profissão contra ICP
  if (icpConfig.b2c_config?.profissoes?.length > 0) {
    const profissaoMatch = icpConfig.b2c_config.profissoes.some(
      (prof: string) =>
        leadData.profissao?.toLowerCase().includes(prof.toLowerCase())
    );
    if (!profissaoMatch) {
      motivos.push(
        `Profissão não está no ICP: ${leadData.profissao}`
      );
    }
  }

  return {
    valid: motivos.length === 0,
    motivos,
  };
}

async function validateB2B(
  leadData: any,
  icpConfig: any
): Promise<{ valid: boolean; motivos: string[] }> {
  const motivos: string[] = [];

  // 1. Validar CNPJ
  if (!leadData.cnpj || !isValidCNPJ(leadData.cnpj)) {
    motivos.push("CNPJ inválido");
  }

  // 2. Validar razão social
  if (!leadData.razao_social || !isValidNome(leadData.razao_social)) {
    motivos.push("Razão social inválida");
  }

  // 3. Se tiver dados da empresa já, validar contra ICP
  if (leadData.setor && icpConfig.b2b_config?.setores?.length > 0) {
    const setorMatch = icpConfig.b2b_config.setores.some(
      (setor: string) =>
        leadData.setor.toLowerCase().includes(setor.toLowerCase())
    );
    if (!setorMatch) {
      motivos.push(`Setor não está no ICP: ${leadData.setor}`);
    }
  }

  if (leadData.porte && icpConfig.b2b_config?.portes?.length > 0) {
    const porteMatch = icpConfig.b2b_config.portes.includes(leadData.porte);
    if (!porteMatch) {
      motivos.push(`Porte não está no ICP: ${leadData.porte}`);
    }
  }

  return {
    valid: motivos.length === 0,
    motivos,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { lead_data, icp_config_id }: ValidateLeadRequest = await req.json();

    console.log(`[VALIDATE-LEAD] Validando lead tipo ${lead_data.tipo}`);

    // 1. Buscar ICP config
    const { data: icpConfig, error: icpError } = await supabaseClient
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();

    if (icpError || !icpConfig) {
      console.error("[VALIDATE-LEAD] ICP não encontrado:", icpError);
      return new Response(
        JSON.stringify({ error: "ICP config não encontrado" }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 2. Validar conforme tipo
    let validacao;
    if (lead_data.tipo === "b2c") {
      validacao = await validateB2C(lead_data, icpConfig);
    } else if (lead_data.tipo === "b2b") {
      validacao = await validateB2B(lead_data, icpConfig);
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo inválido" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[VALIDATE-LEAD] Resultado: ${validacao.valid ? "✅ VÁLIDO" : "❌ INVÁLIDO"}`);
    if (!validacao.valid) {
      console.log("[VALIDATE-LEAD] Motivos:", validacao.motivos);
    }

    return new Response(
      JSON.stringify({
        tipo: lead_data.tipo,
        valido: validacao.valid,
        motivos: validacao.motivos,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[VALIDATE-LEAD] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
