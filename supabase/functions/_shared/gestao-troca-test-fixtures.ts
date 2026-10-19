import { GESTAO_TROCA_IA_DESCRICAO_AREAS } from "./gestao-troca-ia-descricao-schema.ts";
import type { GestaoTrocaIaDescricaoAreaRow } from "./gestao-troca-ia-descricao-schema.ts";

const INTERNO = new Set([
  "painel",
  "bancos",
  "volante_console",
  "forro_carpete",
  "outro",
]);

export function stubTodasDescricaoAreas(
  condicao: GestaoTrocaIaDescricaoAreaRow["condicao"] = "nao_fotografado",
  fotos: number[] = [],
): GestaoTrocaIaDescricaoAreaRow[] {
  return GESTAO_TROCA_IA_DESCRICAO_AREAS.map((area) => ({
    secao: INTERNO.has(area) ? "interno" : "externo",
    area,
    condicao,
    texto: condicao === "nao_fotografado" ? "não fotografado" : "sem alteração visível",
    fotos: condicao === "nao_fotografado" ? [] : fotos,
  }));
}

export function stubVisionJson(extra: Record<string, unknown> = {}) {
  return {
    km_painel: null,
    luzes_painel: null,
    aviso_carroceria: false,
    resumo: "Resumo.",
    conclusao_visual: "Veículo aparentemente em bom estado.",
    descricao_areas: stubTodasDescricaoAreas(),
    itens: [],
    ...extra,
  };
}
