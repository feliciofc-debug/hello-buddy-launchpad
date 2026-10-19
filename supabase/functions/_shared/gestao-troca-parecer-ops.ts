import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";
import { parseProcedenciaResumoJson } from "./gestao-troca-procedencia-display.ts";
import { parseGestaoTrocaIaDescricaoAreasJson } from "./gestao-troca-ia-descricao-schema.ts";
import { loadLatestGestaoTrocaAnalise } from "./gestao-troca-ia-ops.ts";
import { normalizeGestaoTrocaFotos } from "./gestao-troca-fotos.ts";
import { gestaoTrocaRoteiroProgress } from "./gestao-troca-roteiro.ts";
import type { GestaoTrocaIndicioColisaoResult } from "./gestao-troca-indicio-colisao.ts";
import { buildGestaoTrocaLaudoDescricaoPdf } from "./gestao-troca-laudo-descricao-display.ts";
import {
  calcGestaoTrocaParecerRecomendacao,
  type GestaoTrocaParecerRecomendacao,
} from "./gestao-troca-parecer-recomendacao.ts";
import {
  coletarNumerosFatos,
  parecerTextoSemNumerosInventados,
} from "./gestao-troca-parecer-text.ts";
import { insertTrocaEvento } from "./gestao-troca-ops.ts";
import { AI_GATEWAY_CHAT_COMPLETIONS_URL } from "./gestao-troca-ia-vision.ts";

type Db = SupabaseClient;

async function loadProcedenciaResumo(
  sb: Db,
  userId: string,
  consultaId: string | null,
): Promise<ProcedenciaResumoJson | null> {
  if (!consultaId) return null;
  const { data } = await sb.from("veiculo_procedencia_consulta")
    .select("resumo_json")
    .eq("id", consultaId)
    .eq("user_id", userId)
    .maybeSingle();
  return parseProcedenciaResumoJson(data?.resumo_json);
}

export async function buildGestaoTrocaParecerPreview(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<{
  recomendacao: GestaoTrocaParecerRecomendacao;
  fatos: Record<string, unknown>;
  paragrafo_ia: string | null;
  descricao: ReturnType<typeof buildGestaoTrocaLaudoDescricaoPdf>;
}> {
  const { data: troca } = await sb.from("gestao_troca").select("*")
    .eq("id", trocaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");

  const { analise } = await loadLatestGestaoTrocaAnalise(sb, userId, trocaId);
  const descricaoRows = analise?.descricao_areas_json
    ? parseGestaoTrocaIaDescricaoAreasJson(analise.descricao_areas_json)
    : [];
  const procedencia = await loadProcedenciaResumo(
    sb,
    userId,
    troca.procedencia_consulta_id ? String(troca.procedencia_consulta_id) : null,
  );

  const fotosNorm = normalizeGestaoTrocaFotos(troca.fotos_json);
  const roteiro = gestaoTrocaRoteiroProgress(fotosNorm);
  const estrutura = analise?.estrutura_json as Record<string, unknown> | null | undefined;
  const indicio_colisao = estrutura?.indicio_colisao as GestaoTrocaIndicioColisaoResult | null;

  const recomendacao = calcGestaoTrocaParecerRecomendacao({
    valor_proposto: troca.valor_proposto != null ? Number(troca.valor_proposto) : null,
    valor_sugerido: troca.valor_sugerido != null ? Number(troca.valor_sugerido) : null,
    teto: troca.teto != null ? Number(troca.teto) : null,
    faixa_verde_min: troca.faixa_verde_min != null ? Number(troca.faixa_verde_min) : null,
    faixa_verde_max: troca.faixa_verde_max != null ? Number(troca.faixa_verde_max) : null,
    procedencia_consulta_id: troca.procedencia_consulta_id
      ? String(troca.procedencia_consulta_id)
      : null,
    procedencia_resumo: procedencia,
    alerta_km: analise?.alerta_km === true,
    km_painel_conferido: troca.km_painel_conferido === true,
    luzes_painel: typeof analise?.luzes_painel === "boolean" ? analise.luzes_painel : null,
    descricao_areas: descricaoRows,
    laudo_status: troca.laudo_status != null ? String(troca.laudo_status) : null,
    roteiro_faltando: roteiro.faltando,
    indicio_colisao,
  });

  const descricao = buildGestaoTrocaLaudoDescricaoPdf(
    analise?.descricao_areas_json,
    analise?.conclusao_visual != null ? String(analise.conclusao_visual) : null,
  );

  const fatos: Record<string, unknown> = {
    veiculo: {
      marca: troca.marca,
      modelo: troca.modelo,
      placa: troca.placa,
      ano_modelo: troca.ano_modelo,
    },
    recomendacao,
    valores: {
      proposto: troca.valor_proposto,
      sugerido: troca.valor_sugerido,
      teto: troca.teto,
      faixa_verde_min: troca.faixa_verde_min,
      faixa_verde_max: troca.faixa_verde_max,
    },
    procedencia_resumo: procedencia,
    laudo_descritivo: descricao,
    conclusao_visual: analise?.conclusao_visual ?? null,
    alerta_km: analise?.alerta_km === true,
    km_painel_conferido: troca.km_painel_conferido === true,
    luzes_painel: analise?.luzes_painel ?? null,
    laudo_status: troca.laudo_status,
  };

  const paragrafo_ia = await gerarParecerParagrafoIa(fatos);

  return { recomendacao, fatos, paragrafo_ia, descricao };
}

export async function gerarParecerParagrafoIa(
  fatos: Record<string, unknown>,
): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!apiKey) return null;
  try {
    const response = await fetch(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            "Escreva UM parágrafo em português (Brasil) de parecer de avaliador de troca.",
            "Use SOMENTE fatos do JSON; proibido inventar valores, km ou datas que não estejam nos fatos.",
            "Não cite preços de mercado/FIPE além dos números já presentes em valores.",
            JSON.stringify(fatos),
          ].join("\n"),
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const text = String(body?.choices?.[0]?.message?.content ?? "").trim().slice(0, 2000);
    if (!text) return null;
    const nums = coletarNumerosFatos(fatos);
    if (!parecerTextoSemNumerosInventados(text, nums)) return null;
    return text;
  } catch {
    return null;
  }
}

export async function aprovarGestaoTrocaComParecer(
  sb: Db,
  userId: string,
  actorLabel: string,
  trocaId: string,
): Promise<void> {
  const preview = await buildGestaoTrocaParecerPreview(sb, userId, trocaId);
  const snapshot = {
    ...preview.fatos,
    paragrafo_ia: preview.paragrafo_ia,
    gerado_em: new Date().toISOString(),
  };
  const valorAprovado = preview.fatos.valores &&
    typeof preview.fatos.valores === "object"
    ? Number((preview.fatos.valores as Record<string, unknown>).proposto ?? 0)
    : 0;

  await sb.from("gestao_troca").update({
    status: "aprovada",
    valor_aprovado: valorAprovado,
    aprovado_por: userId,
    aprovado_em: new Date().toISOString(),
    parecer_json: snapshot,
    updated_at: new Date().toISOString(),
  }).eq("id", trocaId).eq("user_id", userId);

  await insertTrocaEvento(sb, {
    troca_id: trocaId,
    user_id: userId,
    tipo: "parecer_aprovado",
    descricao: `Parecer: ${preview.recomendacao.rotulo} — aprovado por ${actorLabel}.`,
    autor: actorLabel,
  });
}
