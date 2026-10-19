import type { GestaoTrocaIaDescricaoAreaRow } from "./gestao-troca-ia-descricao-schema.ts";
import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";

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
    return { nivel: "nao_aceitar", rotulo: "🔴 NÃO ACEITAR", motivos, pendencias: buildPendencias(input, pendencias) };
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
  if (!input.procedencia_consulta_id) {
    motivos.push("Procedência veicular não consultada");
  }

  if (motivos.length) {
    return { nivel: "negociar", rotulo: "🟡 NEGOCIAR", motivos, pendencias: buildPendencias(input, pendencias) };
  }

  const naFaixa = proposto >= fvMin && proposto <= fvMax;
  if (!naFaixa) {
    motivos.push("Valor proposto fora da faixa verde");
    return { nivel: "negociar", rotulo: "🟡 NEGOCIAR", motivos, pendencias: buildPendencias(input, pendencias) };
  }

  return {
    nivel: "aceitar",
    rotulo: "🟢 ACEITAR",
    motivos: ["Dentro da faixa verde, procedência sem alertas bloqueantes, sem pendências críticas."],
    pendencias: buildPendencias(input, pendencias),
  };
}

function buildPendencias(
  input: GestaoTrocaParecerRecomendacaoInput,
  base: string[],
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
  return [...new Set(p)];
}
