import type {
  GestaoTrocaIaArea,
  GestaoTrocaIaCategoriaCusto,
  GestaoTrocaIaConfianca,
  GestaoTrocaIaGravidade,
  GestaoTrocaIaTipo,
  GestaoTrocaIaVisionItem,
} from "./gestao-troca-ia-schema.ts";

export const GESTAO_TROCA_IA_LUZ_DIAGNOSTICO = "Verificar diagnóstico.";

function normLuzText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Indicadores normais com carro parado — não entram no laudo. */
export function gestaoTrocaIaFiltrarLuzesAlertaPainel(luzes: string[]): string[] {
  return luzes.filter((l) => l && !gestaoTrocaIaIsLuzInformativa(l));
}

export function gestaoTrocaIaIsLuzInformativa(descricao: string): boolean {
  const d = normLuzText(descricao);
  const patterns = [
    /\bcinto\b/,
    /\bseat\s*belt\b/,
    /\bfreio\s*(de\s*)?estacionamento\b/,
    /\bhandbrake\b/,
    /\bparking\s*brake\b/,
    /\bporta\s+aberta\b/,
    /\bdoor\s*open\b/,
    /\bfarol\s*alto\b/,
    /\bhigh\s*beam\b/,
    /\bluz\s*de\s*farol\b/,
    /\blanterna\b/,
    /\bseta\b/,
    /\bpisca\b/,
    /\bturn\s*signal\b/,
    /\bindicador\s*informativ/,
  ];
  return patterns.some((re) => re.test(d));
}

/** Luzes de falha relevantes para avaliação. */
export function gestaoTrocaIaIsLuzFalha(descricao: string): boolean {
  const d = normLuzText(descricao);
  const patterns = [
    /\bcheck\s*engine\b/,
    /\binje[cç][aã]o\b/,
    /\bmotor\b/,
    /\bairbag\b/,
    /\babs\b/,
    /\b[oó]leo\b/,
    /\boil\b/,
    /\bbateria\b/,
    /\bcarga\b/,
    /\btemperatura\b/,
    /\barrefecimento\b/,
    /\bcoolant\b/,
    /\bfreio\b/,
    /\bbrake\b/,
    /\bdire[cç][aã]o\b/,
    /\beps\b/,
    /\btpms\b/,
    /\bpress[aã]o\s*(dos\s*)?pneu/,
    /\btra[cç][aã]o\b/,
    /\besp\b/,
    /\bestabilidade\b/,
  ];
  return patterns.some((re) => re.test(d));
}

function isLightRelatedItem(item: GestaoTrocaIaVisionItem): boolean {
  if (item.tipo === "luz_alerta") return true;
  const d = normLuzText(item.descricao);
  return /\b(luz|lampada|indicador|alerta|warning|painel)\b/.test(d);
}

export function gestaoTrocaIaDescricaoItemLuz(descricao: string): string {
  const base = String(descricao ?? "").trim().replace(/\s+/g, " ");
  if (!base) return GESTAO_TROCA_IA_LUZ_DIAGNOSTICO;
  if (normLuzText(base).includes("verificar diagnostico")) return base.slice(0, 400);
  return `${base} ${GESTAO_TROCA_IA_LUZ_DIAGNOSTICO}`.slice(0, 400);
}

/** Remove luzes informativas; normaliza luzes de falha. */
export function gestaoTrocaIaFiltrarItensVision(
  itens: GestaoTrocaIaVisionItem[],
): GestaoTrocaIaVisionItem[] {
  const out: GestaoTrocaIaVisionItem[] = [];
  for (const item of itens) {
    if (gestaoTrocaIaIsLuzInformativa(item.descricao)) continue;

    if (!isLightRelatedItem(item)) {
      out.push(item);
      continue;
    }

    if (item.tipo !== "luz_alerta" && !gestaoTrocaIaIsLuzFalha(item.descricao)) {
      continue;
    }

    out.push({
      ...item,
      area: "painel",
      tipo: "luz_alerta",
      descricao: gestaoTrocaIaDescricaoItemLuz(item.descricao),
    });
  }
  return out;
}

export function gestaoTrocaIaLuzesPainelResumo(
  itens: GestaoTrocaIaVisionItem[],
  temFotoPainel: boolean,
): boolean | null {
  const falhas = itens.some((i) => i.tipo === "luz_alerta");
  if (falhas) return true;
  if (temFotoPainel) return false;
  return null;
}

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
  descricao?: string;
}): number | null {
  if (input.tipo === "luz_alerta") return null;
  if (input.confianca === "baixa") return null;
  if (String(input.descricao ?? "").includes("(Indício visual.)")) return null;
  return gestaoTrocaIaValorFromTabela(input.categoria, input.gravidade, input.tabela);
}

export type GestaoTrocaIaFotoRef = { path: string; etiqueta: string };

export function gestaoTrocaIaResolveFotoPath(
  fotos: GestaoTrocaIaFotoRef[],
  item: GestaoTrocaIaVisionItem & { foto_indice?: number | null },
): string | null {
  const idx = item.foto_indice;
  if (typeof idx === "number" && Number.isFinite(idx) && idx >= 1 && idx <= fotos.length) {
    return fotos[idx - 1]?.path ?? null;
  }
  if (item.tipo === "luz_alerta" || item.area === "painel") {
    const painel = fotos.find((f) => /painel/i.test(f.etiqueta));
    if (painel) return painel.path;
  }
  return null;
}

export function gestaoTrocaIaBuildItemRows(input: {
  itens: GestaoTrocaIaVisionItem[];
  fotos: GestaoTrocaIaFotoRef[];
  tabela: GestaoTrocaIaCustoRow[];
  analiseId: string;
  userId: string;
  trocaId: string;
}): { rows: Record<string, unknown>[]; totalPreparacao: number } {
  const rows: Record<string, unknown>[] = [];
  let total = 0;
  input.itens.forEach((item, ordem) => {
    const categoria = gestaoTrocaIaCategoriaFromAreaTipo(item.area, item.tipo);
    const valor = gestaoTrocaIaValorEstimadoItem({
      confianca: item.confianca,
      categoria,
      gravidade: item.gravidade,
      tabela: input.tabela,
      tipo: item.tipo,
      descricao: item.descricao,
    });
    if (valor != null) total += valor;
    const foto_path = gestaoTrocaIaResolveFotoPath(input.fotos, item);
    rows.push({
      analise_id: input.analiseId,
      user_id: input.userId,
      troca_id: input.trocaId,
      ordem,
      area: item.area,
      tipo: item.tipo,
      gravidade: item.gravidade,
      confianca: item.confianca,
      descricao: item.descricao,
      categoria_custo: categoria,
      valor_estimado: valor,
      checklist_key: gestaoTrocaIaAreaToChecklistKey(item.area),
      foto_path,
    });
  });
  return { rows, totalPreparacao: Math.round(total * 100) / 100 };
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
