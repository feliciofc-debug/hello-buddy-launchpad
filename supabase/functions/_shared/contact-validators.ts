import { digitsOnly } from "./brazil-person-doc.ts";
import { parseSpokenBirthDateInput } from "./vitrine-spoken-input.ts";

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function isValidEmail(email: string): boolean {
  const v = String(email || "").trim();
  if (v.length > 254) return false;
  return EMAIL_RE.test(v);
}

export function isValidCep(cep: string): boolean {
  return digitsOnly(cep).length === 8;
}

export function normalizeCep(cep: string): string {
  return digitsOnly(cep).slice(0, 8);
}

/** ISO YYYY-MM-DD */
export function isValidIsoDate(value: string): boolean {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d;
}

/** Aceita DD/MM/AAAA, AAAA-MM-DD ou data falada (ex.: 15 de março de 1980). */
export function parseBirthDateInput(text: string): string | null {
  const raw = String(text || "").trim();
  if (isValidIsoDate(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  const spoken = parseSpokenBirthDateInput(raw);
  return spoken && isValidIsoDate(spoken) ? spoken : null;
}

export function isValidBrazilMobilePhone(phone: string): boolean {
  const d = digitsOnly(phone);
  return d.length >= 10 && d.length <= 13;
}

export function parseMoneyBrl(text: string): number | null {
  const cleaned = String(text || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function parsePrazoMeses(text: string): number | null {
  const d = digitsOnly(text);
  if (!d) return null;
  const n = Number.parseInt(d, 10);
  if (!Number.isFinite(n) || n < 6 || n > 84) return null;
  return n;
}
