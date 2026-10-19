import {
  GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL,
  gestaoTrocaIaDescricaoIcon,
  parseGestaoTrocaIaDescricaoAreasJson,
  type GestaoTrocaIaDescricaoAreaRow,
  type GestaoTrocaIaDescricaoSecao,
} from "./gestao-troca-ia-descricao-schema.ts";

export type GestaoTrocaLaudoDescricaoPdf = {
  externo: GestaoTrocaIaDescricaoAreaRow[];
  interno: GestaoTrocaIaDescricaoAreaRow[];
  conclusao_visual: string | null;
};

export function buildGestaoTrocaLaudoDescricaoPdf(
  descricao_areas_json: unknown,
  conclusao_visual: string | null,
  maxFotos = 32,
): GestaoTrocaLaudoDescricaoPdf | null {
  const rows = parseGestaoTrocaIaDescricaoAreasJson(descricao_areas_json, maxFotos);
  if (!rows.length && !conclusao_visual) return null;
  return {
    externo: rows.filter((r) => r.secao === "externo"),
    interno: rows.filter((r) => r.secao === "interno"),
    conclusao_visual,
  };
}

function formatFotosRef(fotos: number[]): string {
  if (!fotos.length) return "";
  return ` (${fotos.join(", ")})`;
}

export function appendGestaoTrocaLaudoDescricaoPdfLines(
  line: (t: string, bold?: boolean) => void,
  desc: GestaoTrocaLaudoDescricaoPdf | null,
): void {
  if (!desc) return;
  line("Laudo descritivo (IA)", true);
  const sec = (titulo: string, rows: GestaoTrocaIaDescricaoAreaRow[]) => {
    if (!rows.length) return;
    line(titulo, true);
    for (const r of rows) {
      const label = GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL[r.area] ?? r.area;
      const icon = gestaoTrocaIaDescricaoIcon(r.condicao);
      const fotos = r.condicao === "nao_fotografado" ? "" : formatFotosRef(r.fotos);
      line(`${icon} ${label}: ${r.texto}${fotos}`);
    }
  };
  sec("Externo", desc.externo);
  sec("Interno", desc.interno);
  if (desc.conclusao_visual) {
    line(`Conclusão visual: ${desc.conclusao_visual}`);
  }
}

export function gestaoTrocaLaudoDescricaoPorSecao(
  secao: GestaoTrocaIaDescricaoSecao,
  rows: GestaoTrocaIaDescricaoAreaRow[],
): GestaoTrocaIaDescricaoAreaRow[] {
  return rows.filter((r) => r.secao === secao);
}
