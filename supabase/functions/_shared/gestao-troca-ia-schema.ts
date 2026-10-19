export const GESTAO_TROCA_IA_AREAS = [
  "para_choque_dianteiro",
  "para_choque_traseiro",
  "capo",
  "teto",
  "tampa_porta_malas",
  "para_lama_dianteiro_esq",
  "para_lama_dianteiro_dir",
  "porta_dianteira_esq",
  "porta_dianteira_dir",
  "porta_traseira_esq",
  "porta_traseira_dir",
  "lateral_traseira_esq",
  "lateral_traseira_dir",
  "soleira_esq",
  "soleira_dir",
  "retrovisor_esq",
  "retrovisor_dir",
  "farol_esq",
  "farol_dir",
  "lanterna_esq",
  "lanterna_dir",
  "para_brisa",
  "vidro_lateral",
  "vidro_traseiro",
  "roda",
  "pneu",
  "banco",
  "painel",
  "volante",
  "forro_teto",
  "carpete",
  "motor",
  "outro",
] as const;

export type GestaoTrocaIaArea = typeof GESTAO_TROCA_IA_AREAS[number];

export const GESTAO_TROCA_IA_TIPOS = [
  "risco",
  "amassado",
  "pintura_divergente",
  "trinca",
  "quebra",
  "desgaste",
  "ferrugem",
  "mancha",
  "desalinhamento",
  "peca_faltando",
  "luz_alerta",
  "outro",
] as const;

export type GestaoTrocaIaTipo = typeof GESTAO_TROCA_IA_TIPOS[number];

export const GESTAO_TROCA_IA_GRAVIDADES = ["leve", "moderada", "grave"] as const;
export type GestaoTrocaIaGravidade = typeof GESTAO_TROCA_IA_GRAVIDADES[number];

export const GESTAO_TROCA_IA_CONFIANCAS = ["alta", "media", "baixa"] as const;
export type GestaoTrocaIaConfianca = typeof GESTAO_TROCA_IA_CONFIANCAS[number];

export const GESTAO_TROCA_IA_CATEGORIAS_CUSTO = [
  "risco",
  "amassado",
  "pintura_divergente",
  "para_choque",
  "farol_lanterna",
  "pneu",
  "vidro",
  "interior",
  "outro",
] as const;

export type GestaoTrocaIaCategoriaCusto = typeof GESTAO_TROCA_IA_CATEGORIAS_CUSTO[number];

export type GestaoTrocaIaVisionItem = {
  area: GestaoTrocaIaArea;
  tipo: GestaoTrocaIaTipo;
  gravidade: GestaoTrocaIaGravidade;
  confianca: GestaoTrocaIaConfianca;
  descricao: string;
  /** Índice 1-based da foto enviada ao modelo (mesma ordem do prompt). */
  foto_indice?: number | null;
};

export type GestaoTrocaIaVisionResponse = {
  km_painel: number | null;
  luzes_painel: boolean | null;
  aviso_carroceria: boolean;
  resumo: string;
  itens: GestaoTrocaIaVisionItem[];
};

const AREA_SET = new Set<string>(GESTAO_TROCA_IA_AREAS);
const TIPO_SET = new Set<string>(GESTAO_TROCA_IA_TIPOS);
const GRAV_SET = new Set<string>(GESTAO_TROCA_IA_GRAVIDADES);
const CONF_SET = new Set<string>(GESTAO_TROCA_IA_CONFIANCAS);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseKm(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === "string") {
    const digits = v.replace(/\D/g, "");
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function parseDescricao(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, 400);
}

export function validateGestaoTrocaIaVisionResponse(raw: unknown):
  | { ok: true; data: GestaoTrocaIaVisionResponse }
  | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: "Resposta não é objeto JSON." };

  const allowedTop = new Set([
    "km_painel",
    "luzes_painel",
    "aviso_carroceria",
    "resumo",
    "itens",
  ]);
  for (const k of Object.keys(raw)) {
    if (!allowedTop.has(k)) return { ok: false, error: `Campo desconhecido: ${k}` };
  }

  const km_painel = parseKm(raw.km_painel);
  const luzes_painel = parseBool(raw.luzes_painel);
  const aviso_carroceria = raw.aviso_carroceria === true;
  const resumo = String(raw.resumo ?? "").trim().slice(0, 1200);
  if (!Array.isArray(raw.itens)) return { ok: false, error: "itens deve ser array." };

  const itens: GestaoTrocaIaVisionItem[] = [];
  for (let i = 0; i < raw.itens.length; i++) {
    const row = raw.itens[i];
    if (!isPlainObject(row)) return { ok: false, error: `itens[${i}] inválido.` };
    const itemKeys = new Set(["area", "tipo", "gravidade", "confianca", "descricao", "foto_indice"]);
    for (const k of Object.keys(row)) {
      if (!itemKeys.has(k)) return { ok: false, error: `itens[${i}].${k} desconhecido.` };
    }
    const area = String(row.area ?? "");
    const tipo = String(row.tipo ?? "");
    const gravidade = String(row.gravidade ?? "");
    const confianca = String(row.confianca ?? "");
    const descricao = parseDescricao(row.descricao);
    if (!AREA_SET.has(area)) return { ok: false, error: `itens[${i}].area inválida.` };
    if (!TIPO_SET.has(tipo)) return { ok: false, error: `itens[${i}].tipo inválido.` };
    if (!GRAV_SET.has(gravidade)) return { ok: false, error: `itens[${i}].gravidade inválida.` };
    if (!CONF_SET.has(confianca)) return { ok: false, error: `itens[${i}].confianca inválida.` };
    if (!descricao) return { ok: false, error: `itens[${i}].descricao vazia.` };
    let foto_indice: number | null = null;
    if (row.foto_indice != null) {
      const n = Number(row.foto_indice);
      if (Number.isFinite(n) && n >= 1 && n <= 32) foto_indice = Math.floor(n);
    }
    itens.push({
      area: area as GestaoTrocaIaArea,
      tipo: tipo as GestaoTrocaIaTipo,
      gravidade: gravidade as GestaoTrocaIaGravidade,
      confianca: confianca as GestaoTrocaIaConfianca,
      descricao,
      foto_indice,
    });
  }

  return {
    ok: true,
    data: { km_painel, luzes_painel, aviso_carroceria, resumo, itens },
  };
}

export function parseGestaoTrocaIaVisionJson(raw: string): ReturnType<
  typeof validateGestaoTrocaIaVisionResponse
> {
  try {
    const cleaned = String(raw || "")
      .replace(/```(?:json)?|```/gi, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return validateGestaoTrocaIaVisionResponse(parsed);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}
