import {
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  gestaoTrocaFotoIsCrlv,
  type GestaoTrocaFotoEntry,
  type GestaoTrocaFotoSlotOrigem,
} from "./gestao-troca-fotos.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import {
  GESTAO_TROCA_ROTEIRO_SLOTS,
  gestaoTrocaSlotDef,
  isGestaoTrocaFotoSlotId,
  type GestaoTrocaFotoSlotId,
} from "./gestao-troca-roteiro.ts";

/** Slot enviado à IA quando o avaliador ainda não marcou o ângulo. */
export const GESTAO_TROCA_IA_SLOT_A_CLASSIFICAR = "a_classificar";

/** Normaliza token de ângulo vindo da IA (minúsculas, sem acento, espaços → _). */
export function normalizeGestaoTrocaSlotToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const GESTAO_TROCA_IA_SLOT_SINONIMOS: Record<string, GestaoTrocaFotoSlotId> = {
  painel: "painel_ligado",
  painel_instrumentos: "painel_ligado",
  odometro: "painel_ligado",
  motor: "cofre_motor",
  capo_aberto: "cofre_motor",
  porta_malas: "porta_malas_aberto",
  estepe: "estepe_macaco",
};

/** Aceita só id do roteiro ou sinônimo simples; lixo → null. */
export function parseGestaoTrocaIaSlotIdentificado(raw: unknown): GestaoTrocaFotoSlotId | null {
  if (raw == null) return null;
  const token = normalizeGestaoTrocaSlotToken(String(raw));
  if (!token || token === "null") return null;
  if (isGestaoTrocaFotoSlotId(token)) return token;
  return GESTAO_TROCA_IA_SLOT_SINONIMOS[token] ?? null;
}

const GESTAO_TROCA_IA_SLOT_PROMPT_CURTO: Record<GestaoTrocaFotoSlotId, string> = {
  frente: "frente do veículo",
  traseira: "traseira / lanternas",
  lateral_esq: "lateral esquerda (lado do motorista no Brasil)",
  lateral_dir: "lateral direita (lado do passageiro)",
  diag_diant_esq: "três quartos dianteiro esquerdo",
  diag_diant_dir: "três quartos dianteiro direito",
  diag_tras_esq: "três quartos traseiro esquerdo",
  diag_tras_dir: "três quartos traseiro direito",
  teto: "teto externo",
  cofre_motor: "cofre do motor aberto",
  cofre_longarina_esq: "longarina esquerda no cofre",
  cofre_longarina_dir: "longarina direita no cofre",
  porta_malas_aberto: "porta-malas aberto",
  estepe_macaco: "estepe / macaco / chave",
  vao_porta: "vão de porta / batente",
  pneu_de: "pneu dianteiro esquerdo",
  pneu_dd: "pneu dianteiro direito",
  pneu_te: "pneu traseiro esquerdo",
  pneu_td: "pneu traseiro direito",
  painel_ligado: "painel ligado (km e luzes)",
  bancos_dianteiros: "bancos dianteiros",
  bancos_traseiros: "bancos traseiros",
  volante_cambio: "volante e câmbio / console",
  forro_teto: "forro de teto interno",
  manual_manutencao: "manual ou revisões visíveis",
  opcionais_destaque: "opcionais em destaque",
};

/** Lista para prompt quando slot_informado = a_classificar. */
export function gestaoTrocaIaSlotIdsPromptLista(): string {
  return GESTAO_TROCA_ROTEIRO_SLOTS.map(
    (s) => `${s.id}: ${GESTAO_TROCA_IA_SLOT_PROMPT_CURTO[s.id]}`,
  ).join("; ");
}

const LEGACY_ETIQUETA_TO_SLOT: Record<string, GestaoTrocaFotoSlotId> = {
  frente: "frente",
  traseira: "traseira",
  "lateral esquerda": "lateral_esq",
  "lateral direita": "lateral_dir",
  "painel ligado (km)": "painel_ligado",
  "interior dianteiro": "bancos_dianteiros",
  "interior traseiro": "bancos_traseiros",
  motor: "cofre_motor",
  "porta-malas": "porta_malas_aberto",
  estepe: "estepe_macaco",
  "pneus / rodas": "pneu_de",
};

export function gestaoTrocaSlotLabelLoja(slot: string | null | undefined): string {
  const s = String(slot ?? "").trim();
  if (!s || s === GESTAO_TROCA_IA_SLOT_A_CLASSIFICAR) return "A classificar";
  if (!isGestaoTrocaFotoSlotId(s)) return s.replace(/_/g, " ");
  return gestaoTrocaSlotDef(s).label;
}

/** Escolha explícita do avaliador na galeria (etiqueta → slot). */
export function gestaoTrocaSlotFromEtiquetaUsuario(etiqueta: string): GestaoTrocaFotoSlotId | null {
  const canon = etiqueta.trim();
  if (
    !canon ||
    canon === GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR ||
    canon === GESTAO_TROCA_FOTO_ETIQUETA_CRLV ||
    canon === "Outra"
  ) {
    return null;
  }
  const key = canon.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return LEGACY_ETIQUETA_TO_SLOT[key] ?? null;
}

export function gestaoTrocaFotoEntryComEtiquetaUsuario(
  entry: GestaoTrocaFotoEntry,
  etiqueta: string,
): GestaoTrocaFotoEntry {
  if (etiqueta === GESTAO_TROCA_FOTO_ETIQUETA_CRLV) {
    return {
      path: entry.path,
      etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
      slot_origem: "usuario",
    };
  }
  if (etiqueta === GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR) {
    return { path: entry.path, etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR };
  }
  const slot = gestaoTrocaSlotFromEtiquetaUsuario(etiqueta);
  if (slot) {
    return {
      path: entry.path,
      etiqueta,
      slot,
      slot_origem: "usuario",
    };
  }
  return { path: entry.path, etiqueta, slot_origem: "usuario" };
}

/** Slot explícito no registro (usuário ou IA após análise). Nunca infere por etiqueta. */
export function gestaoTrocaFotoSlotAtribuido(
  entry: GestaoTrocaFotoEntry,
): GestaoTrocaFotoSlotId | null {
  const raw = String(entry.slot ?? "").trim();
  if (raw && isGestaoTrocaFotoSlotId(raw)) return raw;
  return null;
}

export function gestaoTrocaFotoMarcadaPorUsuario(entry: GestaoTrocaFotoEntry): boolean {
  return entry.slot_origem === "usuario" && gestaoTrocaFotoSlotAtribuido(entry) != null;
}

export function gestaoTrocaAvisoFotoMarcadaErrada(
  marcadoSlot: GestaoTrocaFotoSlotId,
  identificadoSlot: GestaoTrocaFotoSlotId,
): string {
  const marcado = gestaoTrocaSlotLabelLoja(marcadoSlot);
  const mostra = gestaoTrocaSlotLabelLoja(identificadoSlot);
  return `⚠️ Foto marcada como «${marcado}», mas mostra «${mostra}». Reenvie no lugar certo.`;
}

export function gestaoTrocaAvisoFotoTrocadaParaRow(input: {
  fotoEntry: GestaoTrocaFotoEntry | undefined;
  row: GestaoTrocaIaFotoAnaliseRow;
}): string | null {
  if (!gestaoTrocaFotoMarcadaPorUsuario(input.fotoEntry ?? { path: "", etiqueta: "" })) {
    return null;
  }
  const marcado = gestaoTrocaFotoSlotAtribuido(input.fotoEntry!);
  const idRaw = input.row.slot_identificado;
  if (!marcado || !idRaw || !isGestaoTrocaFotoSlotId(String(idRaw))) return null;
  const identificado = idRaw as GestaoTrocaFotoSlotId;
  if (identificado === marcado) return null;
  return gestaoTrocaAvisoFotoMarcadaErrada(marcado, identificado);
}

/** Slot informado à IA: só o que o usuário marcou; senão a classificar. */
export function gestaoTrocaIaSlotInformado(entry: GestaoTrocaFotoEntry): string {
  if (gestaoTrocaFotoMarcadaPorUsuario(entry)) {
    return gestaoTrocaFotoSlotAtribuido(entry)!;
  }
  return GESTAO_TROCA_IA_SLOT_A_CLASSIFICAR;
}

/** Linhas foto-a-foto no laudo/PDF: nunca inclui paths marcados como CRLV na ficha. */
export function gestaoTrocaIaFotoAnaliseRowsParaPdf(
  rows: GestaoTrocaIaFotoAnaliseRow[] | null | undefined,
  fotosNorm: GestaoTrocaFotoEntry[],
): GestaoTrocaIaFotoAnaliseRow[] {
  if (!rows?.length) return [];
  const crlvPaths = new Set(
    fotosNorm.filter((f) => gestaoTrocaFotoIsCrlv(f)).map((f) => f.path),
  );
  return rows.filter((r) => !r.path || !crlvPaths.has(String(r.path)));
}

export function gestaoTrocaFotosListaParaIa(
  fotos: GestaoTrocaFotoEntry[],
  max = 32,
): (GestaoTrocaFotoEntry & { slot: string })[] {
  const filtered = fotos.filter((f) => !gestaoTrocaFotoIsCrlv(f));
  const out: (GestaoTrocaFotoEntry & { slot: string })[] = [];
  for (const f of filtered) {
    if (out.length >= max) break;
    out.push({ ...f, slot: gestaoTrocaIaSlotInformado(f) });
  }
  return out;
}

export function mergeGestaoTrocaIaSlotsIntoFotos(
  fotos: GestaoTrocaFotoEntry[],
  rows: GestaoTrocaIaFotoAnaliseRow[],
): GestaoTrocaFotoEntry[] {
  const byPath = new Map(rows.filter((r) => r.path).map((r) => [String(r.path), r]));
  const slotOcupado = new Map<GestaoTrocaFotoSlotId, string>();
  for (const f of fotos) {
    const s = gestaoTrocaFotoSlotAtribuido(f);
    if (s) slotOcupado.set(s, f.path);
  }

  return fotos.map((f) => {
    if (gestaoTrocaFotoIsCrlv(f)) return f;
    if (gestaoTrocaFotoMarcadaPorUsuario(f)) return f;
    const row = byPath.get(f.path);
    if (!row?.slot_identificado || !isGestaoTrocaFotoSlotId(String(row.slot_identificado))) {
      return f;
    }
    const slot = row.slot_identificado as GestaoTrocaFotoSlotId;
    if (slotOcupado.has(slot) && slotOcupado.get(slot) !== f.path) {
      return { ...f, etiqueta: f.etiqueta === GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR ? "Outra" : f.etiqueta };
    }
    slotOcupado.set(slot, f.path);
    const def = GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === slot);
    return {
      ...f,
      slot,
      slot_origem: "ia" as GestaoTrocaFotoSlotOrigem,
      etiqueta: def?.label ?? gestaoTrocaSlotLabelLoja(slot),
    };
  });
}

/** Aplica slots da IA só em paths que ainda existem no banco; não remove fotos novas. */
export function applyGestaoTrocaIaSlotMergeToFotosJson(
  fotosAtualDb: GestaoTrocaFotoEntry[],
  mergedFromAnalysis: GestaoTrocaFotoEntry[],
): GestaoTrocaFotoEntry[] {
  const patchByPath = new Map<string, GestaoTrocaFotoEntry>();
  for (const m of mergedFromAnalysis) {
    if (gestaoTrocaFotoIsCrlv(m)) continue;
    if (m.slot_origem === "usuario" && gestaoTrocaFotoSlotAtribuido(m)) continue;
    patchByPath.set(m.path, m);
  }
  return fotosAtualDb.map((f) => {
    if (gestaoTrocaFotoIsCrlv(f)) return f;
    if (f.slot_origem === "usuario") return f;
    const p = patchByPath.get(f.path);
    if (!p) return f;
    return {
      ...f,
      slot: p.slot,
      slot_origem: p.slot_origem,
      etiqueta: p.etiqueta,
    };
  });
}

export function gestaoTrocaLegacyFotoSemOrigem(entry: GestaoTrocaFotoEntry): boolean {
  return entry.slot_origem == null && entry.slot == null &&
    entry.etiqueta !== GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR &&
    entry.etiqueta !== GESTAO_TROCA_FOTO_ETIQUETA_CRLV;
}
