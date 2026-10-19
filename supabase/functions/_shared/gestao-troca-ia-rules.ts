import type {
  GestaoTrocaIaArea,
  GestaoTrocaIaCategoriaCusto,
  GestaoTrocaIaConfianca,
  GestaoTrocaIaGravidade,
  GestaoTrocaIaTipo,
} from "./gestao-troca-ia-schema.ts";

export type GestaoTrocaIaCustoRow = {
  categoria: GestaoTrocaIaCategoriaCusto;
  gravidade: GestaoTrocaIaGravidade;
  valor: number;
};

export function gestaoTrocaIaCategoriaFromAreaTipo(
  area: GestaoTrocaIaArea,
  tipo: GestaoTrocaIaTipo,
): GestaoTrocaIaCategoriaCusto {
  const a = String(area);
  if (a.startsWith("farol_") || a.startsWith("lanterna_")) return "farol_lanterna";
  if (a.startsWith("para_choque")) return "para_choque";
  if (a === "pneu" || a === "roda") return "pneu";
  if (a === "para_brisa" || a.startsWith("vidro_")) return "vidro";
  if (
    ["banco", "painel", "volante", "forro_teto", "carpete"].includes(a)
  ) return "interior";
  if (tipo === "risco") return "risco";
  if (tipo === "amassado") return "amassado";
  if (tipo === "pintura_divergente") return "pintura_divergente";
  return "outro";
}

export function gestaoTrocaIaValorFromTabela(
  categoria: GestaoTrocaIaCategoriaCusto,
  gravidade: GestaoTrocaIaGravidade,
  tabela: GestaoTrocaIaCustoRow[],
): number | null {
  const hit = tabela.find((r) => r.categoria === categoria && r.gravidade === gravidade);
  if (!hit || !Number.isFinite(hit.valor)) return null;
  return Math.round(hit.valor * 100) / 100;
}

export function gestaoTrocaIaValorEstimadoItem(input: {
  confianca: GestaoTrocaIaConfianca;
  categoria: GestaoTrocaIaCategoriaCusto;
  gravidade: GestaoTrocaIaGravidade;
  tabela: GestaoTrocaIaCustoRow[];
  tipo?: GestaoTrocaIaTipo;
}): number | null {
  if (input.confianca === "baixa") return null;
  if (input.tipo === "luz_alerta") return null;
  return gestaoTrocaIaValorFromTabela(input.categoria, input.gravidade, input.tabela);
}

export function gestaoTrocaIaAlertaKm(
  kmFicha: number | null,
  kmPainel: number | null,
  limiarPct = 5,
): boolean {
  if (kmFicha == null || kmPainel == null) return false;
  if (kmFicha <= 0) return false;
  const diff = Math.abs(kmPainel - kmFicha);
  return (diff / kmFicha) * 100 > limiarPct;
}

export function gestaoTrocaIaAvisoCarroceria(
  avisoVision: boolean,
  etiquetasUsadas: string[],
): boolean {
  if (avisoVision) return true;
  const need = ["Frente", "Traseira", "Lateral esquerda", "Lateral direita"];
  const set = new Set(etiquetasUsadas);
  return need.some((e) => !set.has(e));
}

/** Mapeia área da IA → chave do checklist_json da ficha. */
export function gestaoTrocaIaAreaToChecklistKey(area: GestaoTrocaIaArea): string {
  const map: Record<string, string> = {
    para_choque_dianteiro: "para_choques",
    para_choque_traseiro: "para_choques",
    capo: "lataria",
    teto: "lataria",
    tampa_porta_malas: "lataria",
    para_lama_dianteiro_esq: "lataria",
    para_lama_dianteiro_dir: "lataria",
    porta_dianteira_esq: "lataria",
    porta_dianteira_dir: "lataria",
    porta_traseira_esq: "lataria",
    porta_traseira_dir: "lataria",
    lateral_traseira_esq: "lataria",
    lateral_traseira_dir: "lataria",
    soleira_esq: "lataria",
    soleira_dir: "lataria",
    retrovisor_esq: "lataria",
    retrovisor_dir: "lataria",
    farol_esq: "farois_lanternas",
    farol_dir: "farois_lanternas",
    lanterna_esq: "farois_lanternas",
    lanterna_dir: "farois_lanternas",
    para_brisa: "vidros",
    vidro_lateral: "vidros",
    vidro_traseiro: "vidros",
    roda: "rodas",
    pneu: "pneus",
    banco: "bancos",
    painel: "painel_eletronica",
    volante: "interior",
    forro_teto: "interior",
    carpete: "interior",
    motor: "motor",
    outro: "lataria",
  };
  return map[area] ?? "lataria";
}
