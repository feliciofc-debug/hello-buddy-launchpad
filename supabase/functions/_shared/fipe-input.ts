import { type FipeListItem, normalizeFipeText } from "./fipe.ts";

export type FipeLookupInput = {
  marca?: string;
  modelo?: string;
  versao?: string;
  ano_modelo?: string;
  combustivel?: string;
  cambio?: "automatico" | "manual";
  motor?: string;
};

const MODEL_ALIASES: Array<{
  pattern: RegExp;
  brand: string;
  model: string;
}> = [
  { pattern: /\bc3\s+picasso\b/i, brand: "Citroën", model: "C3 Picasso" },
  { pattern: /\bonix\b/i, brand: "Chevrolet", model: "Onix" },
  { pattern: /\bcompass\b/i, brand: "Jeep", model: "Compass" },
  { pattern: /\bcorolla\b/i, brand: "Toyota", model: "Corolla" },
  { pattern: /\bhb20\b/i, brand: "Hyundai", model: "HB20" },
  { pattern: /\bcreta\b/i, brand: "Hyundai", model: "Creta" },
  { pattern: /\btracker\b/i, brand: "Chevrolet", model: "Tracker" },
  { pattern: /\btank\s*300\b/i, brand: "GWM", model: "Tank 300" },
];

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
};

function plain(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.,]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUnderThirty(value: string): number | null {
  const normalized = plain(value).replace(/\be\b/g, " ").replace(/\s+/g, " ")
    .trim();
  if (SMALL_NUMBERS[normalized] != null) return SMALL_NUMBERS[normalized];
  const match = normalized.match(/^vinte\s+(\w+)$/);
  const unit = match?.[1] ? SMALL_NUMBERS[match[1]] : undefined;
  return unit != null && unit >= 1 && unit <= 9 ? 20 + unit : null;
}

export function normalizeFipeYear(value: unknown): string | undefined {
  const normalized = plain(value);
  if (!normalized) return undefined;
  const fullNumeric = normalized.match(/\b((?:19|20)\d{2})\b/);
  if (fullNumeric) return fullNumeric[1];

  const twoThousands = normalized.match(
    /\bdois\s+mil(?:\s+e)?\s+(vinte(?:\s+e\s+\w+)?|(?:dez(?:esseis|essete|enove|oito|assete)|catorze|quatorze|quinze|treze|doze|onze|dez|nove|oito|sete|seis|cinco|quatro|tres|dois|um))\b/,
  );
  if (twoThousands) {
    const suffix = parseUnderThirty(twoThousands[1]);
    if (suffix != null) return String(2000 + suffix);
  }

  const shortWords = normalized.match(
    /\b(vinte(?:\s+e\s+\w+)|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove)\b/,
  );
  if (shortWords) {
    const suffix = parseUnderThirty(shortWords[1]);
    if (suffix != null) return String(2000 + suffix);
  }

  const shortNumeric = normalized.match(/\b(\d{2})\b/);
  if (shortNumeric) {
    const year = Number(shortNumeric[1]);
    return String(year <= 29 ? 2000 + year : 1900 + year);
  }
  return undefined;
}

export function normalizeFipeEngine(value: unknown): string | undefined {
  const normalized = plain(value);
  const numeric = normalized.match(/\b([1-6])\s*[.,]\s*(\d)\b/);
  if (numeric) return `${numeric[1]}.${numeric[2]}`;
  const spokenPoint = normalized.match(
    /\b(um|dois|tres|quatro|cinco|seis)\s+ponto\s+(zero|um|dois|tres|quatro|cinco|seis|sete|oito|nove)\b/,
  );
  if (spokenPoint) {
    return `${SMALL_NUMBERS[spokenPoint[1]]}.${SMALL_NUMBERS[spokenPoint[2]]}`;
  }
  const spokenCompact = normalized.match(
    /\b(um|dois|tres|quatro|cinco|seis)\s+(zero|um|dois|tres|quatro|cinco|seis|sete|oito|nove)\b/,
  );
  if (spokenCompact) {
    return `${SMALL_NUMBERS[spokenCompact[1]]}.${
      SMALL_NUMBERS[spokenCompact[2]]
    }`;
  }
  return undefined;
}

export function normalizeFipeTransmission(
  value: unknown,
): "automatico" | "manual" | undefined {
  const normalized = plain(value);
  if (/\b(?:automatico|automatica|aut|cvt)\b/.test(normalized)) {
    return "automatico";
  }
  if (/\b(?:manual|mecanico|mecanica|mec)\b/.test(normalized)) {
    return "manual";
  }
  return undefined;
}

export function normalizeFipeLookupInput(
  input: FipeLookupInput,
  originalText = "",
): FipeLookupInput {
  const combined = [
    originalText,
    input.modelo,
    input.versao,
    input.ano_modelo,
    input.cambio,
    input.motor,
  ].filter(Boolean).join(" ");
  const alias = MODEL_ALIASES.find(({ pattern }) =>
    pattern.test(plain(combined))
  );
  const cambio = normalizeFipeTransmission(combined);
  const motor = normalizeFipeEngine(combined);
  const ano = normalizeFipeYear(input.ano_modelo) ??
    normalizeFipeYear(originalText || input.modelo);
  const versionParts = [
    input.versao,
    motor,
    cambio === "automatico" ? "Aut" : cambio === "manual" ? "Mec" : undefined,
  ].filter(Boolean).map(String);
  return {
    marca: String(input.marca || alias?.brand || "").trim() || undefined,
    modelo: alias?.model || String(input.modelo || "").trim() || undefined,
    versao: [...new Set(versionParts)].join(" ") || undefined,
    ano_modelo: ano,
    combustivel: String(input.combustivel || "").trim() || undefined,
    cambio,
    motor,
  };
}

export function parseFipeRequestText(text: string): FipeLookupInput {
  const alias = MODEL_ALIASES.find(({ pattern }) => pattern.test(plain(text)));
  return normalizeFipeLookupInput({
    marca: alias?.brand,
    modelo: alias?.model,
  }, text);
}

export function filterFipeModelCandidates(
  candidates: FipeListItem[],
  input: Pick<FipeLookupInput, "motor" | "cambio">,
): FipeListItem[] {
  return candidates.filter((candidate) => {
    const normalized = normalizeFipeText(candidate.name);
    if (
      input.motor &&
      !normalized.replace(/\s+/g, "").includes(input.motor.replace(".", ""))
    ) {
      return false;
    }
    if (
      input.cambio === "automatico" &&
      !/\b(?:AUT|AUTOMATICO|CVT)\b/.test(normalized)
    ) {
      return false;
    }
    if (
      input.cambio === "manual" &&
      /\b(?:AUT|AUTOMATICO|CVT)\b/.test(normalized)
    ) {
      return false;
    }
    return true;
  });
}
