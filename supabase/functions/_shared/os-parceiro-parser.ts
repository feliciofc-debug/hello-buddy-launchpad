export type OsParceiroParsedOrcamento = {
  valor: number | null;
  prazoDias: number | null;
  ambiguo: boolean;
  motivo?: string;
};

function parseValorPtBr(raw: string): number | null {
  const m = raw.match(
    /(?:r\$?\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2})?)/i,
  );
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parsePrazoDias(raw: string): number | null {
  const t = raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const m = t.match(/(\d{1,3})\s*(?:dias?|d\b)/);
  if (m?.[1]) return Number(m[1]);
  if (/\buma semana\b/.test(t)) return 7;
  if (/\bduas semanas\b/.test(t)) return 14;
  return null;
}

/** Parser determinístico para "1950, 7 dias" / "R$ 1.950 · 5 dias". */
export function parseOrcamentoParceiroTexto(text: string): OsParceiroParsedOrcamento {
  const cleaned = String(text || "")
    .replace(/^🎙️\s*Áudio transcrito:\s*/i, "")
    .trim();
  if (!cleaned) {
    return { valor: null, prazoDias: null, ambiguo: true, motivo: "texto vazio" };
  }
  const valor = parseValorPtBr(cleaned);
  const prazoDias = parsePrazoDias(cleaned);
  const valores = (cleaned.match(/(?:r\$?\s*)?\d[\d.,]*/gi) ?? []).length;
  const ambiguo = valores > 1 && valor == null;
  return {
    valor,
    prazoDias,
    ambiguo,
    motivo: ambiguo ? "mais de um valor — confirme" : undefined,
  };
}
