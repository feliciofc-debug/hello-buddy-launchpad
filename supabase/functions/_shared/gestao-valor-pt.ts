function normalizeText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parsePlainNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extrai o primeiro valor monetário em BRL (falado ou escrito). */
export function parseGestaoValorPt(text: string): number | null {
  const t = normalizeText(text);
  if (!t) return null;

  const meioMilhao = t.match(/\bmeio\s+milh[aã]o\b/);
  if (meioMilhao) return 500_000;

  const milhoes = t.match(/(\d+(?:[.,]\d+)?)\s*milh[oõ]es?\b/);
  if (milhoes) {
    const base = parsePlainNumber(milhoes[1].replace(".", ",")) ?? Number(milhoes[1]);
    if (Number.isFinite(base)) return Math.round(base * 1_000_000);
  }

  if (/\bmil\s+e\s+duzentos\b/.test(t)) return 1200;
  const milE = t.match(/\bmil\s+e\s+(\d{1,3})\b/);
  if (milE) {
    const extra = Number(milE[1]);
    if (Number.isFinite(extra)) return 1000 + extra;
  }

  const milCompact = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (milCompact) {
    const base = parsePlainNumber(milCompact[1].replace(".", ",")) ?? Number(milCompact[1]);
    if (Number.isFinite(base)) return Math.round(base * 1000);
  }

  const rs = t.match(/r\$\s*([\d.,]+)/);
  if (rs) {
    const n = parsePlainNumber(rs[1]);
    if (n != null) return n;
  }

  const gastei = t.match(
    /\b(?:gastei|paguei|comprei|vendi|por|de|valor|custo)\s*(?:de\s+)?([\d.,]+)\b/,
  );
  if (gastei) {
    const n = parsePlainNumber(gastei[1]);
    if (n != null) return n;
  }

  const anyNum = t.match(/\b([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?)\b/);
  if (anyNum) {
    const n = parsePlainNumber(anyNum[1]);
    if (n != null) return n;
  }

  return null;
}
