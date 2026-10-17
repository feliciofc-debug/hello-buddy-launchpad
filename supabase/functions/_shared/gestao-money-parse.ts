export function parseGestaoMoneyBr(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/\s/g, "").replace(/^R\$/i, "");

  const hasComma = s.includes(",");
  const dotCount = (s.match(/\./g) ?? []).length;

  if (hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  if (dotCount > 1) {
    s = s.replace(/\./g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  if (dotCount === 1) {
    const [, dec] = s.split(".");
    if (dec && dec.length >= 1 && dec.length <= 2 && /^\d+$/.test(dec)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    if (dec && dec.length === 3 && /^\d+$/.test(dec)) {
      s = s.replace(".", "");
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatGestaoMoneyInputPreview(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseGestaoMoneyField(
  raw: string,
  options?: { allowZero?: boolean },
): number | null {
  const n = parseGestaoMoneyBr(raw);
  if (n == null) return null;
  if (!options?.allowZero && n <= 0) return null;
  return n;
}
