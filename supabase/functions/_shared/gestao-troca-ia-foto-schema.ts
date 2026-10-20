import {
  GESTAO_TROCA_IA_SLOT_A_CLASSIFICAR,
  parseGestaoTrocaIaSlotIdentificado,
} from "./gestao-troca-foto-slot.ts";
import { gestaoTrocaIaFiltrarLuzesAlertaPainel } from "./gestao-troca-ia-rules.ts";
import type { GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";

export const GESTAO_TROCA_IA_FOTO_QUALIDADES = ["boa", "limitada", "insuficiente"] as const;
export type GestaoTrocaIaFotoQualidade = typeof GESTAO_TROCA_IA_FOTO_QUALIDADES[number];

export const GESTAO_TROCA_IA_ACHADO_TIPOS = [
  "risco",
  "amassado",
  "diferenca_tonalidade",
  "sinal_repintura",
  "fresta_desalinhada",
  "solda_aparente",
  "massa_suspeita",
  "parafuso_mexido",
  "selante_fora_padrao",
  "corrosao",
  "vazamento_fluido",
  "farol_lanterna_divergente",
  "vidro_trincado",
  "vidro_gravacao_divergente",
  "pneu_desgaste_irregular",
  "pneu_sulco_baixo",
  "pneus_marcas_diferentes",
  "desgaste_interno",
  "mancha_interna",
  "luz_alerta",
  "outro",
] as const;

export type GestaoTrocaIaAchadoTipo = typeof GESTAO_TROCA_IA_ACHADO_TIPOS[number];

export const GESTAO_TROCA_IA_ACHADO_SEVERIDADES = ["leve", "moderada", "grave"] as const;
export const GESTAO_TROCA_IA_ACHADO_CONFIANCAS = ["baixa", "media", "alta"] as const;

export type GestaoTrocaIaFotoAchado = {
  tipo: GestaoTrocaIaAchadoTipo;
  local: string;
  severidade: typeof GESTAO_TROCA_IA_ACHADO_SEVERIDADES[number];
  confianca: typeof GESTAO_TROCA_IA_ACHADO_CONFIANCAS[number];
  evidencia: string;
};

export type GestaoTrocaIaFotoAnaliseRow = {
  indice: number;
  slot_informado: GestaoTrocaFotoSlotId | string;
  slot_identificado: GestaoTrocaFotoSlotId | string | null;
  qualidade_imagem: GestaoTrocaIaFotoQualidade;
  motivo_qualidade: string;
  descricao: string;
  achados: GestaoTrocaIaFotoAchado[];
  nao_da_para_afirmar: string[];
  path?: string;
  km_painel?: number | null;
  luzes_alerta?: string[];
};

const TIPO_SET = new Set<string>(GESTAO_TROCA_IA_ACHADO_TIPOS);
const Q_SET = new Set<string>(GESTAO_TROCA_IA_FOTO_QUALIDADES);
const SEV_SET = new Set<string>(GESTAO_TROCA_IA_ACHADO_SEVERIDADES);
const CONF_SET = new Set<string>(GESTAO_TROCA_IA_ACHADO_CONFIANCAS);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parseGestaoTrocaIaFotoAnaliseJson(
  raw: unknown,
  maxIndice: number,
): GestaoTrocaIaFotoAnaliseRow | null {
  if (!isPlainObject(raw)) return null;
  const indice = Number(raw.indice);
  if (!Number.isFinite(indice) || indice < 1 || indice > maxIndice) return null;

  const qualidade = String(raw.qualidade_imagem ?? "");
  if (!Q_SET.has(qualidade)) return null;

  const achados: GestaoTrocaIaFotoAchado[] = [];
  if (Array.isArray(raw.achados)) {
    for (const a of raw.achados) {
      if (!isPlainObject(a)) continue;
      const tipo = String(a.tipo ?? "");
      if (!TIPO_SET.has(tipo)) continue;
      const severidade = String(a.severidade ?? "");
      const confianca = String(a.confianca ?? "");
      if (!SEV_SET.has(severidade) || !CONF_SET.has(confianca)) continue;
      if (qualidade === "insuficiente") continue;
      achados.push({
        tipo: tipo as GestaoTrocaIaAchadoTipo,
        local: String(a.local ?? "").slice(0, 120),
        severidade: severidade as GestaoTrocaIaFotoAchado["severidade"],
        confianca: confianca as GestaoTrocaIaFotoAchado["confianca"],
        evidencia: String(a.evidencia ?? "").slice(0, 400),
      });
    }
  }

  const nao = Array.isArray(raw.nao_da_para_afirmar)
    ? raw.nao_da_para_afirmar.map((s) => String(s).slice(0, 200)).filter(Boolean)
    : [];

  const slot_identificado = parseGestaoTrocaIaSlotIdentificado(raw.slot_identificado);
  const slotInformado = String(raw.slot_informado ?? "");
  const painelVisivel = slotInformado === "painel_ligado" || slot_identificado === "painel_ligado";

  let km_painel: number | null = null;
  if (painelVisivel && raw.km_painel != null && raw.km_painel !== "") {
    const n = Number(raw.km_painel);
    if (Number.isFinite(n) && n >= 0) km_painel = Math.round(n);
  }
  const luzesRaw = painelVisivel && Array.isArray(raw.luzes_alerta)
    ? raw.luzes_alerta.map((s) => String(s).slice(0, 80)).filter(Boolean)
    : [];
  const luzesFiltradas = gestaoTrocaIaFiltrarLuzesAlertaPainel(luzesRaw);
  const luzes_alerta = luzesFiltradas.length ? luzesFiltradas : undefined;

  return {
    indice: Math.round(indice),
    slot_informado: slotInformado || GESTAO_TROCA_IA_SLOT_A_CLASSIFICAR,
    slot_identificado,
    qualidade_imagem: qualidade as GestaoTrocaIaFotoQualidade,
    motivo_qualidade: String(raw.motivo_qualidade ?? "").slice(0, 300),
    descricao: String(raw.descricao ?? "").slice(0, 800),
    achados: qualidade === "insuficiente" ? [] : achados,
    nao_da_para_afirmar: nao,
    path: raw.path != null ? String(raw.path) : undefined,
    km_painel,
    luzes_alerta,
  };
}

export function validateGestaoTrocaIaFotosAnaliseJson(
  rows: GestaoTrocaIaFotoAnaliseRow[],
  expectedCount: number,
): boolean {
  if (rows.length !== expectedCount) return false;
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.indice)) return false;
    seen.add(r.indice);
  }
  return seen.size === expectedCount;
}

/** Tipos que não geram custo automático (indício estrutural). */
export const GESTAO_TROCA_IA_ACHADOS_SEM_CUSTO = new Set<GestaoTrocaIaAchadoTipo>([
  "solda_aparente",
  "massa_suspeita",
  "parafuso_mexido",
  "selante_fora_padrao",
  "fresta_desalinhada",
  "sinal_repintura",
  "diferenca_tonalidade",
]);
