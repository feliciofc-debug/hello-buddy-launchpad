import { gestaoTrocaAchadoRef } from "./gestao-troca-indicio-recalc.ts";
import { gestaoTrocaIaAchadoToVisionItem } from "./gestao-troca-ia-foto-map.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import {
  gestaoTrocaIaBuildItemRows,
  gestaoTrocaIaFiltrarItensVision,
  type GestaoTrocaIaCustoRow,
} from "./gestao-troca-ia-rules.ts";
import { servicoSugeridoFromAchadoTipo } from "./gestao-troca-servico-sugerido.ts";
import type { GestaoTrocaIaVisionItem } from "./gestao-troca-ia-schema.ts";

export function gestaoTrocaIaVisionItemsComRefs(
  rows: GestaoTrocaIaFotoAnaliseRow[],
): { item: GestaoTrocaIaVisionItem; achado_ref: string; achado_tipo: string }[] {
  const out: { item: GestaoTrocaIaVisionItem; achado_ref: string; achado_tipo: string }[] = [];
  for (const row of rows) {
    row.achados.forEach((achado, idx) => {
      out.push({
        item: gestaoTrocaIaAchadoToVisionItem({
          achado,
          fotoIndice: row.indice,
          slot: String(row.slot_informado),
        }),
        achado_ref: gestaoTrocaAchadoRef(row.indice, idx + 1),
        achado_tipo: achado.tipo,
      });
    });
  }
  return out;
}

export function gestaoTrocaIaItemRowsFromFotoAnalise(input: {
  rows: GestaoTrocaIaFotoAnaliseRow[];
  fotos: { path: string; etiqueta: string }[];
  tabela: GestaoTrocaIaCustoRow[];
  analiseId: string;
  userId: string;
  trocaId: string;
}): { rows: Record<string, unknown>[]; totalPreparacao: number } {
  const packed = gestaoTrocaIaVisionItemsComRefs(input.rows);
  const itens = gestaoTrocaIaFiltrarItensVision(packed.map((p) => p.item));
  const refByDesc = new Map<string, string>();
  const tipoByRef = new Map<string, string>();
  for (const p of packed) {
    refByDesc.set(p.item.descricao, p.achado_ref);
    tipoByRef.set(p.achado_ref, p.achado_tipo);
  }
  const built = gestaoTrocaIaBuildItemRows({
    itens,
    fotos: input.fotos,
    tabela: input.tabela,
    analiseId: input.analiseId,
    userId: input.userId,
    trocaId: input.trocaId,
  });
  const rows = built.rows.map((row) => {
    const desc = String(row.descricao ?? "");
    const ref = refByDesc.get(desc) ?? null;
    const achadoTipo = ref ? tipoByRef.get(ref) : null;
    return {
      ...row,
      achado_ref: ref,
      servico: achadoTipo ? servicoSugeridoFromAchadoTipo(achadoTipo as never) : "nenhum",
    };
  });
  return { rows, totalPreparacao: built.totalPreparacao };
}
