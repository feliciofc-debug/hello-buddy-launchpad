import type { GestaoTrocaIaDescricaoAreaRow } from "./gestao-troca-ia-descricao-schema.ts";
import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";
import type { GestaoTrocaIndicioNivel } from "./gestao-troca-indicio-colisao.ts";
import { gestaoTrocaIndicioColisaoMaxNivel } from "./gestao-troca-indicio-colisao.ts";
import type { GestaoTrocaIndicioColisaoResult } from "./gestao-troca-indicio-colisao.ts";
import type { GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";

export type GestaoTrocaParecerNivel = "aceitar" | "negociar" | "nao_aceitar";

export type GestaoTrocaParecerRecomendacaoInput = {
  valor_proposto: number | null;
  valor_sugerido: number | null;
  teto: number | null;
  faixa_verde_min: number | null;
  faixa_verde_max: number | null;
  procedencia_consulta_id: string | null;
  procedencia_resumo: ProcedenciaResumoJson | null;
  alerta_km: boolean;
  km_painel_conferido: boolean;
  luzes_painel: boolean | null;
  descricao_areas: GestaoTrocaIaDescricaoAreaRow[];
  laudo_status: string | null;
  roteiro_faltando?: GestaoTrocaFotoSlotId[];
  indicio_colisao?: GestaoTrocaIndicioColisaoResult | null;
};

export type GestaoTrocaParecerRecomendacao = {
  nivel: GestaoTrocaParecerNivel;
  rotulo: string;
  motivos: string[];
  pendencias: string[];
};

const CRITICAS_NAO_FOTO = new Set(["pneus", "motor", "porta_malas"]);

function procedenciaBloqueia(resumo: ProcedenciaResumoJson | null): string[] {
  if (!resumo) return [];
  const m: string[] = [];
  if (resumo.leilao.possui) m.push("Registro de leilão");
  if (resumo.perda_total.possui) m.push("Perda total");
  if (resumo.roubo_furto.possui) m.push("Histórico roubo/furto");
  if (resumo.renajud.possui) m.push("Restrição Renajud");
  return m;
}

export function calcGestaoTrocaParecerRecomendacao(
  input: GestaoTrocaParecerRecomendacaoInput,
): GestaoTrocaParecerRecomendacao {
  const motivos: string[] = [];
  const pendencias: string[] = [];

  const proposto = input.valor_proposto ?? 0;
  const sugerido = input.valor_sugerido ?? 0;
  const teto = input.teto ?? Infinity;
  const fvMin = input.faixa_verde_min ?? 0;
  const fvMax = input.faixa_verde_max ?? Infinity;

  const bloqueios = procedenciaBloqueia(input.procedencia_resumo);
  if (bloqueios.length) motivos.push(...bloqueios);
  if (proposto > teto) motivos.push("Valor proposto acima do teto");

  if (motivos.length) {
    return {
      nivel: "nao_aceitar",
      rotulo: "🔴 NÃO ACEITAR",
      motivos,
      pendencias: buildPendencias(input, pendencias, "nenhum"),
    };
  }

  if (proposto > sugerido && proposto <= teto) {
    motivos.push("Valor proposto acima do sugerido (dentro do teto)");
  }
  if (input.alerta_km && !input.km_painel_conferido) {
    motivos.push("Divergência de KM no painel sem conferência");
  }
  if (input.luzes_painel === true) {
    motivos.push("Luz de falha identificada no painel");
  }
  if (input.descricao_areas.some((a) => a.condicao === "alteracao_grave")) {
    motivos.push("Laudo descritivo com alteração grave");
  }
  const indicioMax: GestaoTrocaIndicioNivel = input.indicio_colisao
    ? gestaoTrocaIndicioColisaoMaxNivel(input.indicio_colisao)
    : "nenhum";
  if (indicioMax === "moderado") {
    motivos.push("Indício visual de colisão (moderado)");
  }
  if (indicioMax === "forte") {
    motivos.push("Indício visual de colisão (forte)");
  }
  if (!input.procedencia_consulta_id) {
    motivos.push("Procedência veicular não consultada");
  }

  if (motivos.length) {
    const nivel = indicioMax === "forte" ? "negociar" : "negociar";
    return { nivel, rotulo: "🟡 NEGOCIAR", motivos, pendencias: buildPendencias(input, pendencias, indicioMax) };
  }

  const naFaixa = proposto >= fvMin && proposto <= fvMax;
  if (!naFaixa) {
    motivos.push("Valor proposto fora da faixa verde");
    return {
      nivel: "negociar",
      rotulo: "🟡 NEGOCIAR",
      motivos,
      pendencias: buildPendencias(input, pendencias, indicioMax),
    };
  }

  return {
    nivel: "aceitar",
    rotulo: "🟢 ACEITAR",
    motivos: ["Dentro da faixa verde, procedência sem alertas bloqueantes, sem pendências críticas."],
    pendencias: buildPendencias(input, pendencias, indicioMax),
  };
}

function buildPendencias(
  input: GestaoTrocaParecerRecomendacaoInput,
  base: string[],
  indicioMax: GestaoTrocaIndicioNivel,
): string[] {
  const p = [...base];
  if (input.alerta_km && !input.km_painel_conferido) p.push("Conferir KM do painel");
  if (String(input.laudo_status ?? "rascunho") !== "finalizado") {
    p.push("Finalizar laudo de avaliação");
  }
  if (!input.procedencia_consulta_id) p.push("Consultar procedência veicular");
  for (const area of input.descricao_areas) {
    if (area.condicao === "nao_fotografado" && CRITICAS_NAO_FOTO.has(area.area)) {
      p.push(`Fotografar: ${area.area.replace(/_/g, " ")}`);
    }
  }
  if (input.roteiro_faltando?.length) {
    p.push("Completar roteiro de fotos da vistoria");
  }
  if (indicioMax === "moderado" || indicioMax === "forte") {
    p.push("Verificar estrutura (elevador/vistoria cautelar)");
  }
  if (indicioMax === "forte") {
    p.push("Vistoria cautelar antes de aceitar");
  }
  return [...new Set(p)];
}
