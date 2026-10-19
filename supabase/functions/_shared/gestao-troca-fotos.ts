export type GestaoTrocaFotoSlotOrigem = "usuario" | "ia";

export type GestaoTrocaFotoEntry = {
  path: string;
  etiqueta: string;
  /** Slot do roteiro (usuário ou IA após análise). */
  slot?: string;
  /** Quem atribuiu o slot — nunca inferido por ordem de upload. */
  slot_origem?: GestaoTrocaFotoSlotOrigem;
};

export const GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR = "A classificar";
export const GESTAO_TROCA_FOTO_ETIQUETA_CRLV = "Documento (CRLV)";

/** Etiquetas que o avaliador pode escolher na galeria (sem ordem automática). */
export const GESTAO_TROCA_FOTO_ETIQUETAS: string[] = [
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  "Lateral esquerda",
  "Frente",
  "Traseira",
  "Lateral direita",
  "Painel ligado (km)",
  "Interior dianteiro",
  "Interior traseiro",
  "Motor",
  "Porta-malas",
  "Estepe",
  "Pneus / rodas",
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  "Outra",
];

/** @deprecated Lista usada só para migrar dados legados (etiqueta por índice). */
export const GESTAO_TROCA_FOTO_ETIQUETAS_LEGADO_POR_INDICE: string[] = [
  "Lateral esquerda",
  "Frente",
  "Traseira",
  "Lateral direita",
  "Painel ligado (km)",
  "Interior dianteiro",
  "Interior traseiro",
  "Motor",
  "Porta-malas",
  "Estepe",
  "Pneus / rodas",
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  "Outra",
];

/** Corrige etiquetas salvas em minúsculo ou abreviadas (escolha manual do avaliador). */
export function canonicalGestaoTrocaEtiqueta(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR;
  if (GESTAO_TROCA_FOTO_ETIQUETAS.includes(trimmed)) return trimmed;
  const key = trimmed.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const aliases: Record<string, string> = {
    traseira: "Traseira",
    frente: "Frente",
    painel: "Painel ligado (km)",
    "painel ligado": "Painel ligado (km)",
    "painel ligado (km)": "Painel ligado (km)",
    "lateral esquerda": "Lateral esquerda",
    "lateral direita": "Lateral direita",
    "interior dianteiro": "Interior dianteiro",
    "interior traseiro": "Interior traseiro",
    motor: "Motor",
    "porta-malas": "Porta-malas",
    estepe: "Estepe",
    "pneus / rodas": "Pneus / rodas",
    outra: "Outra",
    "a classificar": GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  };
  return aliases[key] ?? trimmed;
}

function migrateLegacyEntry(
  o: Record<string, unknown>,
  path: string,
  index: number,
): GestaoTrocaFotoEntry {
  const slot = o.slot != null ? String(o.slot).trim() : undefined;
  const slot_origem = o.slot_origem === "usuario" || o.slot_origem === "ia"
    ? o.slot_origem
    : undefined;
  let etiqueta = canonicalGestaoTrocaEtiqueta(String(o.etiqueta ?? ""));

  if (slot_origem === "usuario" || (slot && isExplicitUsuarioSlot(slot, slot_origem))) {
    return {
      path,
      etiqueta,
      ...(slot ? { slot } : {}),
      slot_origem: slot_origem ?? "usuario",
    };
  }

  if (slot_origem === "ia" && slot) {
    return { path, etiqueta, slot, slot_origem: "ia" };
  }

  // Legado: etiqueta atribuída pelo sistema (posição) — próxima IA reorganiza, sem aviso.
  const legadoPorIndice = GESTAO_TROCA_FOTO_ETIQUETAS_LEGADO_POR_INDICE[index];
  if (
    !slot &&
    !slot_origem &&
    legadoPorIndice &&
    etiqueta === legadoPorIndice
  ) {
    return { path, etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR, slot_origem: "ia" };
  }

  if (!slot && !slot_origem && etiqueta !== GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR) {
    return { path, etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR };
  }

  return {
    path,
    etiqueta,
    ...(slot ? { slot } : {}),
    ...(slot_origem ? { slot_origem } : {}),
  };
}

function isExplicitUsuarioSlot(slot: string, origem: GestaoTrocaFotoSlotOrigem | undefined): boolean {
  return origem === "usuario" || (origem == null && slot.length > 0);
}

export function normalizeGestaoTrocaFotos(raw: unknown): GestaoTrocaFotoEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: GestaoTrocaFotoEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (typeof row === "string" && row.trim()) {
      out.push({
        path: row.trim(),
        etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
      });
      continue;
    }
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      const path = String(o.path ?? "").trim();
      if (!path) continue;
      out.push(migrateLegacyEntry(o, path, i));
    }
  }
  return out;
}

export function gestaoTrocaFotoPaths(fotos: GestaoTrocaFotoEntry[]): string[] {
  return fotos.map((f) => f.path);
}

/** Fotos elegíveis para laudo IA (exclui CRLV), ordem de cadastro. */
export function gestaoTrocaFotosParaIa(
  fotos: GestaoTrocaFotoEntry[],
  max = 32,
): GestaoTrocaFotoEntry[] {
  return fotos.filter((f) => f.etiqueta !== GESTAO_TROCA_FOTO_ETIQUETA_CRLV).slice(0, max);
}
