function normalizeSpoken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isFinanciamentoSpokenSkip(text: string): boolean {
  const v = normalizeSpoken(text.replace(/<<INTERACTIVE_ID:[^>]+>>/gi, ""));
  if (!v) return false;
  if (/^(pular|pula|skip)$/.test(v)) return true;
  if (/\bpular essa\b/.test(v)) return true;
  if (/\bprefiro nao informar\b/.test(v)) return true;
  if (/\bnao quero informar\b/.test(v)) return true;
  return false;
}

export function normalizeSpokenEmail(text: string): string {
  let v = String(text || "").trim().toLowerCase();
  v = v.replace(/\s+arroba\s+/gi, "@");
  v = v.replace(/\s+at\s+/gi, "@");
  v = v.replace(/\s+ponto\s+/gi, ".");
  v = v.replace(/\s+dot\s+/gi, ".");
  v = v.replace(/\bunderline\b/g, "_");
  v = v.replace(/\b(traco|hifen|hífen)\b/g, "-");
  v = v.replace(/\s+/g, "");
  return v;
}

const MONTH_NAMES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Estende DD/MM/AAAA com datas faladas em português. */
export function parseSpokenBirthDateInput(text: string): string | null {
  const raw = String(text || "").trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const norm = normalizeSpoken(raw);
  const long = norm.match(
    /^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})$/,
  );
  if (long) {
    const day = Number.parseInt(long[1], 10);
    const month = MONTH_NAMES[long[2]];
    const year = Number.parseInt(long[3], 10);
    if (month && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return iso;
    }
  }
  const short = norm.match(/^(\d{1,2})\s+do\s+(\d{1,2})\s+de\s+(\d{4})$/);
  if (short) {
    const day = Number.parseInt(short[1], 10);
    const month = Number.parseInt(short[2], 10);
    const year = Number.parseInt(short[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}
