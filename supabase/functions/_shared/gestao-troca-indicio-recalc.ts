import type { GestaoTrocaEspessuraFaixas } from "./gestao-troca-espessura.ts";
import { parseGestaoTrocaEspessuraJson } from "./gestao-troca-espessura.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import {
  calcIndicioColisao,
  type GestaoTrocaIndicioAchadoInput,
  type GestaoTrocaIndicioColisaoResult,
} from "./gestao-troca-indicio-colisao.ts";

export function parseGestaoTrocaAnaliseFotoRows(raw: unknown): GestaoTrocaIaFotoAnaliseRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r === "object") as GestaoTrocaIaFotoAnaliseRow[];
}

/** achado_ref formato f7a2 = foto 7, achado índice 2 (1-based no array). */
export function gestaoTrocaAchadoRef(fotoIndice: number, achadoIndex: number): string {
  return `f${fotoIndice}a${achadoIndex}`;
}

export function recalcIndicioColisaoGestaoTroca(input: {
  fotos_json: unknown;
  espessura_json: unknown;
  faixas?: GestaoTrocaEspessuraFaixas;
  itens?: { achado_ref?: string | null; decisao?: string }[];
}): GestaoTrocaIndicioColisaoResult {
  const rows = parseGestaoTrocaAnaliseFotoRows(input.fotos_json);
  const descartados = new Set(
    (input.itens ?? [])
      .filter((i) => String(i.decisao) === "descartado" && i.achado_ref)
      .map((i) => String(i.achado_ref)),
  );
  const achados: GestaoTrocaIndicioAchadoInput[] = [];
  for (const row of rows) {
    row.achados.forEach((a, idx) => {
      const ref = gestaoTrocaAchadoRef(row.indice, idx + 1);
      achados.push({
        ...a,
        foto: row.indice,
        slot: String(row.slot_informado),
        descartado: descartados.has(ref),
      });
    });
  }
  const espessura = parseGestaoTrocaEspessuraJson(input.espessura_json);
  return calcIndicioColisao(achados, espessura, input.faixas);
}
