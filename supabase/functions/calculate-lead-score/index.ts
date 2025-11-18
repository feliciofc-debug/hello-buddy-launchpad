import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoringRequest {
  lead_id: string;
  lead_tipo: "b2c" | "b2b";
  icp_config_id: string;
}

interface ScoreBreakdown {
  [criterio: string]: number;
}

// SCORING B2C
async function scoreLeadB2C(
  lead: any,
  icpConfig: any
): Promise<{
  score: number;
  breakdown: ScoreBreakdown;
  insights: string[];
}> {
  const breakdown: ScoreBreakdown = {};
  const insights: string[] = [];
  let totalScore = 0;
  const maxScore = 100;

  // 1. Profissão alinhada com ICP (30 pontos)
  const profissoes_icp = icpConfig.b2c_config?.profissoes || [];
  if (
    profissoes_icp.length > 0 &&
    profissoes_icp.some((p: string) =>
      lead.profissao?.toLowerCase().includes(p.toLowerCase())
    )
  ) {
    breakdown["profissao_alinhada"] = 30;
    totalScore += 30;
    insights.push("✅ Profissão alinhada com ICP");
  } else if (profissoes_icp.length > 0) {
    breakdown["profissao_alinhada"] = 10;
    totalScore += 10;
    insights.push("⚠️ Profissão parcialmente alinhada");
  }

  // 2. Especialidade (20 pontos)
  const especialidades_icp = icpConfig.b2c_config?.especialidades || [];
  if (
    lead.especialidade &&
    especialidades_icp.some((e: string) =>
      lead.especialidade.toLowerCase().includes(e.toLowerCase())
    )
  ) {
    breakdown["especialidade_match"] = 20;
    totalScore += 20;
    insights.push("✅ Especialidade encontrada no ICP");
  } else if (lead.especialidade) {
    breakdown["especialidade_match"] = 5;
    totalScore += 5;
  }

  // 3. Localização no ICP (15 pontos)
  const cidades_icp = icpConfig.b2c_config?.cidades || [];
  const estados_icp = icpConfig.b2c_config?.estados || [];

  if (
    lead.cidade &&
    cidades_icp.some((c: string) =>
      lead.cidade.toLowerCase().includes(c.toLowerCase())
    )
  ) {
    breakdown["localizacao"] = 15;
    totalScore += 15;
    insights.push(`✅ Localizado em cidade dentro do ICP`);
  } else if (
    lead.estado &&
    estados_icp.some((e: string) => lead.estado?.includes(e))
  ) {
    breakdown["localizacao"] = 8;
    totalScore += 8;
  } else if (lead.cidade && lead.estado) {
    breakdown["localizacao"] = 3;
    totalScore += 3;
  }

  // 4. Dados de contato completo (15 pontos)
  let contatos = 0;
  if (lead.email) contatos++;
  if (lead.telefone) contatos++;
  if (lead.whatsapp) contatos++;

  breakdown["contatos_completos"] = contatos * 5;
  totalScore += contatos * 5;
  if (contatos === 3) {
    insights.push("✅ Todos os dados de contato preenchidos");
  }

  // 5. Redes sociais enriquecidas (12 pontos)
  let redes = 0;
  if (lead.linkedin_url) redes++;
  if (lead.instagram_username) redes++;
  if (lead.facebook_url) redes++;

  breakdown["redes_sociais"] = redes * 4;
  totalScore += redes * 4;
  if (redes > 0) {
    insights.push(`✅ ${redes} rede(s) social(is) verificada(s)`);
  }

  // 6. Sinais de poder aquisitivo (8 pontos)
  const sinais = lead.sinais_poder_aquisitivo || [];
  if (sinais.length > 0) {
    breakdown["poder_aquisitivo"] = Math.min(sinais.length * 4, 8);
    totalScore += breakdown["poder_aquisitivo"];
    insights.push(`⭐ ${sinais.length} sinal(is) de poder aquisitivo detectado(s)`);
  }

  // Garantir que não ultrapasse o máximo
  totalScore = Math.min(totalScore, maxScore);

  return {
    score: totalScore,
    breakdown,
    insights,
  };
}

// SCORING B2B
async function scoreLeadB2B(
  lead: any,
  icpConfig: any
): Promise<{
  score: number;
  breakdown: ScoreBreakdown;
  insights: string[];
}> {
  const breakdown: ScoreBreakdown = {};
  const insights: string[] = [];
  let totalScore = 0;
  const maxScore = 100;

  // 1. Setor alinhado (30 pontos)
  const setores_icp = icpConfig.b2b_config?.setores || [];
  if (
    setores_icp.length > 0 &&
    setores_icp.some((s: string) =>
      lead.setor?.toLowerCase().includes(s.toLowerCase())
    )
  ) {
    breakdown["setor_alinhado"] = 30;
    totalScore += 30;
    insights.push("✅ Setor alinhado com ICP");
  } else if (setores_icp.length > 0 && lead.setor) {
    breakdown["setor_alinhado"] = 10;
    totalScore += 10;
    insights.push("⚠️ Setor parcialmente alinhado");
  }

  // 2. Porte da empresa (25 pontos)
  const portes_icp = icpConfig.b2b_config?.portes || [];
  if (portes_icp.includes(lead.porte)) {
    breakdown["porte_match"] = 25;
    totalScore += 25;
    insights.push(`✅ Porte (${lead.porte}) dentro do ICP`);
  } else if (lead.porte) {
    breakdown["porte_match"] = 5;
    totalScore += 5;
  }

  // 3. Capital social (20 pontos)
  const capital_min = icpConfig.b2b_config?.capital_minimo || 0;
  const capital_max = icpConfig.b2b_config?.capital_maximo;
  
  if (lead.capital_social) {
    if (lead.capital_social >= capital_min) {
      if (!capital_max || lead.capital_social <= capital_max) {
        breakdown["capital_social"] = 20;
        totalScore += 20;
        insights.push("✅ Capital social dentro da faixa do ICP");
      } else {
        breakdown["capital_social"] = 10;
        totalScore += 10;
        insights.push("⚠️ Capital social acima da faixa do ICP");
      }
    } else {
      breakdown["capital_social"] = 5;
      totalScore += 5;
      insights.push("⚠️ Capital social abaixo da faixa do ICP");
    }
  }

  // 4. Situação cadastral (15 pontos)
  const situacoes_icp = icpConfig.b2b_config?.situacao || ["ATIVA"];
  if (situacoes_icp.includes(lead.situacao_cadastral)) {
    breakdown["situacao_cadastral"] = 15;
    totalScore += 15;
    insights.push("✅ Situação cadastral adequada");
  } else if (lead.situacao_cadastral) {
    insights.push(`⚠️ Situação cadastral: ${lead.situacao_cadastral}`);
  }

  // 5. Localização (10 pontos)
  const cidades_icp = icpConfig.b2b_config?.cidades || [];
  const estados_icp = icpConfig.b2b_config?.estados || [];

  if (
    lead.cidade &&
    cidades_icp.some((c: string) =>
      lead.cidade.toLowerCase().includes(c.toLowerCase())
    )
  ) {
    breakdown["localizacao"] = 10;
    totalScore += 10;
    insights.push("✅ Localizada em cidade do ICP");
  } else if (
    lead.estado &&
    estados_icp.some((e: string) => lead.estado?.includes(e))
  ) {
    breakdown["localizacao"] = 5;
    totalScore += 5;
  }

  // Garantir que não ultrapasse o máximo
  totalScore = Math.min(totalScore, maxScore);

  return {
    score: totalScore,
    breakdown,
    insights,
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

    const { lead_id, lead_tipo, icp_config_id }: ScoringRequest = await req.json();

    console.log(`[CALCULATE-SCORE] Calculando score para lead ${lead_id} (${lead_tipo})`);

    // 1. Buscar lead
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads_descobertos")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("[CALCULATE-SCORE] Lead não encontrado:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead não encontrado" }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 2. Buscar ICP config
    const { data: icpConfig, error: icpError } = await supabaseClient
      .from("icp_configs")
      .select("*")
      .eq("id", icp_config_id)
      .single();

    if (icpError || !icpConfig) {
      console.error("[CALCULATE-SCORE] ICP não encontrado:", icpError);
      return new Response(
        JSON.stringify({ error: "ICP config não encontrado" }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 3. Calcular score conforme tipo
    let resultado;
    if (lead_tipo === "b2c") {
      resultado = await scoreLeadB2C(lead, icpConfig);
    } else if (lead_tipo === "b2b") {
      resultado = await scoreLeadB2B(lead, icpConfig);
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo inválido" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[CALCULATE-SCORE] Score calculado: ${resultado.score}/100`);

    // 4. Atualizar lead no banco
    const { error: updateError } = await supabaseClient
      .from("leads_descobertos")
      .update({
        score: resultado.score,
        score_breakdown: resultado.breakdown,
        insights: resultado.insights,
        status: resultado.score >= icpConfig.score_minimo ? "qualificado" : "rejeitado",
        qualified_at: new Date().toISOString()
      })
      .eq("id", lead_id);

    if (updateError) {
      console.error("[CALCULATE-SCORE] Erro ao atualizar lead:", updateError);
    }

    return new Response(
      JSON.stringify({
        lead_id,
        tipo: lead_tipo,
        score: resultado.score,
        breakdown: resultado.breakdown,
        insights: resultado.insights,
        qualificado: resultado.score >= icpConfig.score_minimo,
        score_minimo: icpConfig.score_minimo,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[CALCULATE-SCORE] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
