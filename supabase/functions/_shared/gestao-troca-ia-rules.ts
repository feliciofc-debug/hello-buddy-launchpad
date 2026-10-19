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
  if (area === "pneus" || area === "rodas") return "pneus";
  if (
    area === "lataria" || area === "pintura" || area === "para_choques" ||
    area === "farois_lanternas" || area === "vidros"
  ) {
    return "funilaria_pintura";
  }
  if (area === "interior" || area === "bancos") return "estetica";
  if (
    area === "motor" || area === "cambio" || area === "suspensao" ||
    area === "freios" || area === "ar_condicionado" || area === "painel_eletronica"
  ) {
    return "mecanica";
  }
  if (tipo === "desgaste" && area === "pneus") return "pneus";
  return "outros";
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
}): number | null {
  if (input.confianca === "baixa") return null;
  return gestaoTrocaIaValorFromTabela(input.categoria, input.gravidade, input.tabela);
}

/** Divergência acima de 5% entre KM da ficha e odômetro lido nas fotos. */
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

/** Aviso quando a IA não teve cobertura suficiente da carroceria externa. */
export function gestaoTrocaIaAvisoCarroceria(
  avisoVision: boolean,
  etiquetasUsadas: string[],
): boolean {
  if (avisoVision) return true;
  const need = ["Frente", "Traseira", "Lateral esquerda", "Lateral direita"];
  const set = new Set(etiquetasUsadas);
  return need.some((e) => !set.has(e));
}

export function gestaoTrocaIaAreaToChecklistKey(area: GestaoTrocaIaArea): string {
  return area;
}
