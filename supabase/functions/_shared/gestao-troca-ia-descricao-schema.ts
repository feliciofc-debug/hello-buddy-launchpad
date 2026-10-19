export const GESTAO_TROCA_IA_DESCRICAO_SECOES = ["externo", "interno"] as const;
export type GestaoTrocaIaDescricaoSecao = typeof GESTAO_TROCA_IA_DESCRICAO_SECOES[number];

export const GESTAO_TROCA_IA_DESCRICAO_AREAS = [
  "lataria",
  "pintura",
  "para_choque_dianteiro",
  "para_choque_traseiro",
  "farois_lanternas",
  "vidros",
  "retrovisores",
  "rodas",
  "pneus",
  "estepe",
  "motor",
  "porta_malas",
  "painel",
  "bancos",
  "volante_console",
  "forro_carpete",
  "outro",
] as const;

export type GestaoTrocaIaDescricaoAreaId = typeof GESTAO_TROCA_IA_DESCRICAO_AREAS[number];

export const GESTAO_TROCA_IA_DESCRICAO_CONDICOES = [
  "sem_alteracao_visivel",
  "alteracao_leve",
  "alteracao_moderada",
  "alteracao_grave",
  "nao_fotografado",
] as const;

export type GestaoTrocaIaDescricaoCondicao = typeof GESTAO_TROCA_IA_DESCRICAO_CONDICOES[number];

export type GestaoTrocaIaDescricaoAreaRow = {
  secao: GestaoTrocaIaDescricaoSecao;
  area: GestaoTrocaIaDescricaoAreaId;
  condicao: GestaoTrocaIaDescricaoCondicao;
  texto: string;
  fotos: number[];
};

const SECAO_SET = new Set<string>(GESTAO_TROCA_IA_DESCRICAO_SECOES);
const AREA_SET = new Set<string>(GESTAO_TROCA_IA_DESCRICAO_AREAS);
const COND_SET = new Set<string>(GESTAO_TROCA_IA_DESCRICAO_CONDICOES);

export const GESTAO_TROCA_IA_DESCRICAO_AREA_LABEL: Record<GestaoTrocaIaDescricaoAreaId, string> = {
  lataria: "Lataria",
  pintura: "Pintura",
  para_choque_dianteiro: "Para-choque dianteiro",
  para_choque_traseiro: "Para-choque traseiro",
  farois_lanternas: "Faróis/lanternas",
  vidros: "Vidros",
  retrovisores: "Retrovisores",
  rodas: "Rodas",
  pneus: "Pneus",
  estepe: "Estepe",
  motor: "Motor",
  porta_malas: "Porta-malas",
  painel: "Painel",
  bancos: "Bancos",
  volante_console: "Volante e console",
  forro_carpete: "Forro/carpete",
  outro: "Outro",
};

export function validateGestaoTrocaIaDescricaoAreas(
  raw: unknown,
  maxFotoIndice: number,
): { ok: true; rows: GestaoTrocaIaDescricaoAreaRow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "descricao_areas deve ser array." };
  const seen = new Set<string>();
  const rows: GestaoTrocaIaDescricaoAreaRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return { ok: false, error: `descricao_areas[${i}] inválido.` };
    const o = row as Record<string, unknown>;
    const secao = String(o.secao ?? "");
    const area = String(o.area ?? "");
    const condicao = String(o.condicao ?? "");
    const texto = String(o.texto ?? "").trim().slice(0, 500);
    if (!SECAO_SET.has(secao)) return { ok: false, error: `descricao_areas[${i}].secao inválida.` };
    if (!AREA_SET.has(area)) return { ok: false, error: `descricao_areas[${i}].area inválida.` };
    if (!COND_SET.has(condicao)) return { ok: false, error: `descricao_areas[${i}].condicao inválida.` };
    if (!texto) return { ok: false, error: `descricao_areas[${i}].texto vazio.` };
    if (seen.has(area)) return { ok: false, error: `descricao_areas: área duplicada ${area}.` };
    seen.add(area);
    let fotos: number[] = [];
    if (Array.isArray(o.fotos)) {
      fotos = o.fotos
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= maxFotoIndice)
        .map((n) => Math.floor(n));
    }
    if (condicao === "nao_fotografado") {
      if (fotos.length > 0) {
        return { ok: false, error: `descricao_areas[${i}]: nao_fotografado exige fotos=[].` };
      }
    } else if (fotos.length < 1) {
      return { ok: false, error: `descricao_areas[${i}]: exige ≥1 foto válida.` };
    }
    rows.push({
      secao: secao as GestaoTrocaIaDescricaoSecao,
      area: area as GestaoTrocaIaDescricaoAreaId,
      condicao: condicao as GestaoTrocaIaDescricaoCondicao,
      texto,
      fotos,
    });
  }
  for (const area of GESTAO_TROCA_IA_DESCRICAO_AREAS) {
    if (!seen.has(area)) {
      return { ok: false, error: `descricao_areas: falta área ${area}.` };
    }
  }
  return { ok: true, rows };
}

export function parseGestaoTrocaIaDescricaoAreasJson(
  raw: unknown,
  maxFotoIndice = 32,
): GestaoTrocaIaDescricaoAreaRow[] {
  const v = validateGestaoTrocaIaDescricaoAreas(raw, maxFotoIndice);
  return v.ok ? v.rows : [];
}

export function gestaoTrocaIaDescricaoIcon(condicao: GestaoTrocaIaDescricaoCondicao): string {
  switch (condicao) {
    case "sem_alteracao_visivel":
      return "✅";
    case "alteracao_leve":
      return "🟡";
    case "alteracao_moderada":
      return "🟠";
    case "alteracao_grave":
      return "🔴";
    case "nao_fotografado":
      return "⚪";
    default:
      return "⚪";
  }
}
