import type { GestaoTrocaEspessuraPainelId } from "./gestao-troca-espessura.ts";
import {
  classificarEspessuraUm,
  type GestaoTrocaEspessuraFaixas,
  DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
} from "./gestao-troca-espessura.ts";
import type { GestaoTrocaIaAchadoTipo, GestaoTrocaIaFotoAchado } from "./gestao-troca-ia-foto-schema.ts";

export type GestaoTrocaIndicioNivel = "nenhum" | "fraco" | "moderado" | "forte";

export type GestaoTrocaIndicioRegiao = "dianteira" | "traseira" | "lateral_esq" | "lateral_dir";

export type GestaoTrocaIndicioEvidencia = {
  regiao: GestaoTrocaIndicioRegiao;
  tipo: GestaoTrocaIaAchadoTipo | "espessura_massa" | "espessura_repintura";
  foto?: number;
  texto: string;
};

export type GestaoTrocaIndicioColisaoResult = Record<
  GestaoTrocaIndicioRegiao,
  { nivel: GestaoTrocaIndicioNivel; evidencias: GestaoTrocaIndicioEvidencia[] }
>;

export type GestaoTrocaIndicioAchadoInput = GestaoTrocaIaFotoAchado & {
  foto: number;
  slot?: string;
  descartado?: boolean;
};

const REGIAO_SLOTS: Record<GestaoTrocaIndicioRegiao, string[]> = {
  dianteira: ["frente", "diag_diant_esq", "diag_diant_dir", "cofre_motor", "cofre_longarina_esq", "cofre_longarina_dir"],
  traseira: ["traseira", "diag_tras_esq", "diag_tras_dir", "porta_malas_aberto"],
  lateral_esq: ["lateral_esq", "diag_diant_esq", "diag_tras_esq"],
  lateral_dir: ["lateral_dir", "diag_diant_dir", "diag_tras_dir"],
};

const ESPESSURA_REGIAO: Record<GestaoTrocaEspessuraPainelId, GestaoTrocaIndicioRegiao> = {
  capo: "dianteira",
  paralama_de: "dianteira",
  paralama_dd: "dianteira",
  porta_de: "lateral_esq",
  porta_te: "lateral_esq",
  lateral_te: "lateral_esq",
  porta_dd: "lateral_dir",
  porta_td: "lateral_dir",
  lateral_td: "lateral_dir",
  tampa_traseira: "traseira",
  teto: "dianteira",
};

function regiaoFromAchado(a: GestaoTrocaIndicioAchadoInput): GestaoTrocaIndicioRegiao[] {
  const slot = String(a.slot ?? "").toLowerCase();
  const loc = `${a.local} ${slot}`.toLowerCase();
  const regs = new Set<GestaoTrocaIndicioRegiao>();
  for (const [reg, slots] of Object.entries(REGIAO_SLOTS) as [GestaoTrocaIndicioRegiao, string[]][]) {
    if (slots.some((s) => slot.includes(s))) regs.add(reg);
  }
  if (/\bdianteir|\bfrente|\bcofre|\bcap[oô]\b/.test(loc)) regs.add("dianteira");
  if (/\btraseir|\bporta.malas|\blanterna traseir/.test(loc)) regs.add("traseira");
  if (/\besquerdo|\besq\b|\bde\b/.test(loc)) regs.add("lateral_esq");
  if (/\bdireito|\bdir\b|\bdd\b/.test(loc)) regs.add("lateral_dir");
  if (!regs.size) regs.add("dianteira");
  return [...regs];
}

function pesoAchado(tipo: GestaoTrocaIaAchadoTipo): number {
  if (tipo === "solda_aparente") return 5;
  if (tipo === "parafuso_mexido") return 2;
  if (tipo === "fresta_desalinhada") return 2;
  if (tipo === "massa_suspeita") return 2;
  if (tipo === "selante_fora_padrao") return 2;
  if (tipo === "farol_lanterna_divergente") return 1;
  if (tipo === "sinal_repintura") return 1;
  return 1;
}

function nivelFromScore(score: number): GestaoTrocaIndicioNivel {
  if (score <= 0) return "nenhum";
  if (score >= 5) return "forte";
  if (score >= 3) return "moderado";
  return "fraco";
}

export function calcIndicioColisao(
  achados: GestaoTrocaIndicioAchadoInput[],
  espessura: Partial<Record<GestaoTrocaEspessuraPainelId, number>> = {},
  faixas: GestaoTrocaEspessuraFaixas = DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
): GestaoTrocaIndicioColisaoResult {
  const scores: Record<GestaoTrocaIndicioRegiao, number> = {
    dianteira: 0,
    traseira: 0,
    lateral_esq: 0,
    lateral_dir: 0,
  };
  const evidencias: Record<GestaoTrocaIndicioRegiao, GestaoTrocaIndicioEvidencia[]> = {
    dianteira: [],
    traseira: [],
    lateral_esq: [],
    lateral_dir: [],
  };

  const ativos = achados.filter((a) => !a.descartado && a.confianca !== "baixa");

  for (const a of ativos) {
    let w = pesoAchado(a.tipo);
    const regs = regiaoFromAchado(a);
    if (a.tipo === "parafuso_mexido") {
      const parafuso = ativos.filter((x) => x.tipo === "parafuso_mexido" && x.foto === a.foto);
      const fresta = ativos.some((x) => x.tipo === "fresta_desalinhada" && regs.some((r) =>
        regiaoFromAchado(x).includes(r)
      ));
      if (parafuso.length && fresta) w = 3;
    }
    for (const reg of regs) {
      scores[reg] += w;
      evidencias[reg].push({
        regiao: reg,
        tipo: a.tipo,
        foto: a.foto,
        texto: `${a.tipo.replace(/_/g, " ")} (${a.local}): ${a.evidencia}`.slice(0, 280),
      });
    }
  }

  for (const [painel, val] of Object.entries(espessura) as [GestaoTrocaEspessuraPainelId, number][]) {
    const cls = classificarEspessuraUm(val, faixas);
    const reg = ESPESSURA_REGIAO[painel];
    if (!reg) continue;
    if (cls === "massa") {
      scores[reg] += 2;
      evidencias[reg].push({
        regiao: reg,
        tipo: "espessura_massa",
        texto: `Medição ${val} µm em ${painel.replace(/_/g, " ")} (faixa massa)`,
      });
    } else if (cls === "repintura") {
      scores[reg] += 1;
      evidencias[reg].push({
        regiao: reg,
        tipo: "espessura_repintura",
        texto: `Medição ${val} µm em ${painel.replace(/_/g, " ")} (repintura)`,
      });
    }
  }

  const out = {} as GestaoTrocaIndicioColisaoResult;
  for (const reg of Object.keys(scores) as GestaoTrocaIndicioRegiao[]) {
    out[reg] = { nivel: nivelFromScore(scores[reg]), evidencias: evidencias[reg] };
  }
  return out;
}

export function gestaoTrocaIndicioColisaoMaxNivel(
  r: GestaoTrocaIndicioColisaoResult,
): GestaoTrocaIndicioNivel {
  const order: GestaoTrocaIndicioNivel[] = ["nenhum", "fraco", "moderado", "forte"];
  let max: GestaoTrocaIndicioNivel = "nenhum";
  for (const reg of Object.values(r)) {
    if (order.indexOf(reg.nivel) > order.indexOf(max)) max = reg.nivel;
  }
  return max;
}

export const GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER =
  "Indício visual — confirmar em elevador/vistoria cautelar.";
