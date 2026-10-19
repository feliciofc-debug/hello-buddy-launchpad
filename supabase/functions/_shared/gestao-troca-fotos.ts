export type GestaoTrocaFotoEntry = {
  path: string;
  etiqueta: string;
  /** Slot do roteiro TROCA-1.9 (opcional; legado usa só etiqueta). */
  slot?: string;
};

export const GESTAO_TROCA_FOTO_ETIQUETAS: string[] = [
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
  "Documento (CRLV)",
  "Outra",
];

const ETIQUETA_DOC = "Documento (CRLV)";

/** Corrige etiquetas salvas em minúsculo ou abreviadas (legado / mobile). */
export function canonicalGestaoTrocaEtiqueta(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "Outra";
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
  };
  return aliases[key] ?? trimmed;
}

export function normalizeGestaoTrocaFotos(raw: unknown): GestaoTrocaFotoEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: GestaoTrocaFotoEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (typeof row === "string" && row.trim()) {
      const sug = GESTAO_TROCA_FOTO_ETIQUETAS[i] ?? "Outra";
      out.push({ path: row.trim(), etiqueta: sug });
      continue;
    }
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      const path = String(o.path ?? "").trim();
      if (!path) continue;
      let etiqueta = canonicalGestaoTrocaEtiqueta(String(o.etiqueta ?? "") || "Outra");
      if (!GESTAO_TROCA_FOTO_ETIQUETAS.includes(etiqueta)) etiqueta = "Outra";
      const slot = o.slot != null ? String(o.slot).trim() : undefined;
      out.push({ path, etiqueta, ...(slot ? { slot } : {}) });
    }
  }
  return out;
}

export function gestaoTrocaFotoPaths(fotos: GestaoTrocaFotoEntry[]): string[] {
  return fotos.map((f) => f.path);
}

/** Fotos elegíveis para laudo IA (exclui CRLV). */
export function gestaoTrocaFotosParaIa(
  fotos: GestaoTrocaFotoEntry[],
  max = 16,
): GestaoTrocaFotoEntry[] {
  const filtered = fotos.filter((f) => f.etiqueta !== ETIQUETA_DOC);
  const padrao = GESTAO_TROCA_FOTO_ETIQUETAS.filter((e) => e !== ETIQUETA_DOC && e !== "Outra");
  const byEtiqueta = new Map<string, GestaoTrocaFotoEntry>();
  const outras: GestaoTrocaFotoEntry[] = [];
  for (const f of filtered) {
    if (padrao.includes(f.etiqueta) && !byEtiqueta.has(f.etiqueta)) {
      byEtiqueta.set(f.etiqueta, f);
    } else {
      outras.push(f);
    }
  }
  const ordered: GestaoTrocaFotoEntry[] = [];
  for (const e of padrao) {
    const hit = byEtiqueta.get(e);
    if (hit) ordered.push(hit);
  }
  for (const f of filtered) {
    if (!ordered.some((x) => x.path === f.path)) ordered.push(f);
  }
  return ordered.slice(0, max);
}
