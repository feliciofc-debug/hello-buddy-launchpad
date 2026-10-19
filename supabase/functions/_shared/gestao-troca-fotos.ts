export type GestaoTrocaFotoEntry = {
  path: string;
  etiqueta: string;
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
      let etiqueta = String(o.etiqueta ?? "").trim() || "Outra";
      if (!GESTAO_TROCA_FOTO_ETIQUETAS.includes(etiqueta)) etiqueta = "Outra";
      out.push({ path, etiqueta });
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
