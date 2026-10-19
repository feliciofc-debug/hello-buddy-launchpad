import type { GestaoTrocaEspessuraPainelId } from "./gestao-troca-espessura.ts";
import {
  classificarEspessuraUm,
  type GestaoTrocaEspessuraFaixas,
  DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
} from "./gestao-troca-espessura.ts";
import type { GestaoTrocaIaAchadoTipo, GestaoTrocaIaFotoAchado } from "./gestao-troca-ia-foto-schema.ts";
import { isGestaoTrocaFotoSlotId, type GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";

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

const SLOTS_INTERNO = new Set([
  "painel_ligado",
  "bancos_dianteiros",
  "bancos_traseiros",
  "volante_cambio",
  "forro_teto",
  "manual_manutencao",
  "opcionais_destaque",
]);

const SLOTS_PNEU = new Set(["pneu_de", "pneu_dd", "pneu_te", "pneu_td"]);

/** Região vem do slot; espessura do teto não pontua indício. */
const SLOT_REGIAO: Partial<Record<GestaoTrocaFotoSlotId, GestaoTrocaIndicioRegiao>> = {
  frente: "dianteira",
  traseira: "traseira",
  lateral_esq: "lateral_esq",
  lateral_dir: "lateral_dir",
  diag_diant_esq: "dianteira",
  diag_diant_dir: "dianteira",
  diag_tras_esq: "traseira",
  diag_tras_dir: "traseira",
  teto: "dianteira",
  cofre_motor: "dianteira",
  cofre_longarina_esq: "dianteira",
  cofre_longarina_dir: "dianteira",
  porta_malas_aberto: "traseira",
  estepe_macaco: "traseira",
  vao_porta: "dianteira",
};

const ESPESSURA_REGIAO: Partial<Record<GestaoTrocaEspessuraPainelId, GestaoTrocaIndicioRegiao>> = {
  capo: "dianteira",
  paralama_de: "dianteira",
  paralama_dd: "dianteira",
  tampa_traseira: "traseira",
  porta_de: "lateral_esq",
  porta_te: "lateral_esq",
  lateral_te: "lateral_esq",
  porta_dd: "lateral_dir",
  porta_td: "lateral_dir",
  lateral_td: "lateral_dir",
};

export function pesoIndicioColisaoAchado(
  tipo: GestaoTrocaIaAchadoTipo,
  severidade: GestaoTrocaIaFotoAchado["severidade"],
): number {
  switch (tipo) {
    case "solda_aparente":
      return 5;
    case "massa_suspeita":
    case "parafuso_mexido":
    case "fresta_desalinhada":
    case "selante_fora_padrao":
      return 2;
    case "diferenca_tonalidade":
    case "sinal_repintura":
    case "farol_lanterna_divergente":
    case "vidro_gravacao_divergente":
      return 1;
    case "amassado":
      return severidade === "leve" ? 0 : 1;
    default:
      return 0;
  }
}

function regiaoFromSlot(slotRaw: string | undefined): GestaoTrocaIndicioRegiao | null {
  const slot = String(slotRaw ?? "").trim();
  if (!slot || SLOTS_INTERNO.has(slot) || SLOTS_PNEU.has(slot)) return null;
  if (!isGestaoTrocaFotoSlotId(slot)) return null;
  return SLOT_REGIAO[slot as GestaoTrocaFotoSlotId] ?? null;
}

function nivelRegiao(
  score: number,
  temSoldaMedia: boolean,
  temMassaEspessura: boolean,
  parafusoFresta: boolean,
): GestaoTrocaIndicioNivel {
  if (temSoldaMedia || (score >= 5 && temMassaEspessura)) return "forte";
  if (parafusoFresta || score >= 3) return "moderado";
  if (score >= 1 || (temMassaEspessura && score === 0)) return "fraco";
  return "nenhum";
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
  const soldaMedia: Record<GestaoTrocaIndicioRegiao, boolean> = {
    dianteira: false,
    traseira: false,
    lateral_esq: false,
    lateral_dir: false,
  };
  const massaEsp: Record<GestaoTrocaIndicioRegiao, boolean> = {
    dianteira: false,
    traseira: false,
    lateral_esq: false,
    lateral_dir: false,
  };

  const ativos = achados.filter((a) => !a.descartado && a.confianca !== "baixa");

  for (const a of ativos) {
    const reg = regiaoFromSlot(a.slot);
    if (!reg) continue;
    const w = pesoIndicioColisaoAchado(a.tipo, a.severidade);
    if (w <= 0) continue;
    if (a.tipo === "solda_aparente" && (a.confianca === "media" || a.confianca === "alta")) {
      soldaMedia[reg] = true;
    }
    scores[reg] += w;
    evidencias[reg].push({
      regiao: reg,
      tipo: a.tipo,
      foto: a.foto,
      texto: `${a.tipo.replace(/_/g, " ")} (${a.local}): ${a.evidencia}`.slice(0, 280),
    });
  }

  for (const [painel, val] of Object.entries(espessura) as [GestaoTrocaEspessuraPainelId, number][]) {
    if (painel === "teto") continue;
    const cls = classificarEspessuraUm(val, faixas);
    const reg = ESPESSURA_REGIAO[painel];
    if (!reg) continue;
    if (cls === "massa") {
      massaEsp[reg] = true;
      evidencias[reg].push({
        regiao: reg,
        tipo: "espessura_massa",
        texto: `Medição ${val} µm em ${painel.replace(/_/g, " ")} (faixa massa)`,
      });
    } else if (cls === "repintura") {
      scores[reg] += 0;
      evidencias[reg].push({
        regiao: reg,
        tipo: "espessura_repintura",
        texto: `Medição ${val} µm em ${painel.replace(/_/g, " ")} (repintura)`,
      });
    }
  }

  const out = {} as GestaoTrocaIndicioColisaoResult;
  for (const reg of Object.keys(scores) as GestaoTrocaIndicioRegiao[]) {
    const parafuso = ativos.some((a) => a.tipo === "parafuso_mexido" && regiaoFromSlot(a.slot) === reg);
    const fresta = ativos.some((a) => a.tipo === "fresta_desalinhada" && regiaoFromSlot(a.slot) === reg);
    const parafusoFresta = parafuso && fresta;
    out[reg] = {
      nivel: nivelRegiao(scores[reg], soldaMedia[reg], massaEsp[reg], parafusoFresta),
      evidencias: evidencias[reg],
    };
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
