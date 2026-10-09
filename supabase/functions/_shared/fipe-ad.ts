import { type FipePrice, normalizeFipeText } from "./fipe.ts";

export type LastFipeResult = FipePrice & {
  queryBrand: string;
  queryModel: string;
  yearId?: string;
  created_at: string;
};

export type FipeAdDecision =
  | { action: "none" }
  | { action: "use_last"; value: string; referenceMonth: string }
  | {
    action: "confirm";
    queriedValue: string;
    suppliedValue: string;
    referenceMonth: string;
  };

function yearFrom(value: unknown): number | null {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

export function parseBrlValue(value: unknown): number | null {
  const clean = String(value ?? "").replace(/[^\d,.-]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function lastFipeMatchesAd(
  last: LastFipeResult,
  ad: { titulo?: unknown; versao?: unknown; ano?: unknown },
): boolean {
  const age = Date.now() - new Date(last.created_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) {
    return false;
  }
  const haystack = normalizeFipeText(`${ad.titulo ?? ""} ${ad.versao ?? ""}`);
  const brand = normalizeFipeText(last.queryBrand || last.brand);
  const model = normalizeFipeText(last.queryModel || last.model);
  if (!brand || !model || !haystack.includes(brand)) return false;
  const meaningfulModelTokens = model
    .split(" ")
    .filter((token) =>
      token.length >= 2 && !["FLEX", "AUT", "MEC"].includes(token)
    );
  if (!meaningfulModelTokens.length) return false;
  const matchedTokens = meaningfulModelTokens.filter((token) =>
    haystack.split(" ").includes(token)
  );
  if (matchedTokens.length < Math.min(2, meaningfulModelTokens.length)) {
    return false;
  }
  const adYear = yearFrom(ad.ano);
  const resultYear = yearFrom(last.modelYear);
  return adYear != null && resultYear != null && adYear === resultYear;
}

export function decideFipeForAd(input: {
  last?: LastFipeResult | null;
  titulo?: unknown;
  versao?: unknown;
  ano?: unknown;
  suppliedFipe?: unknown;
}): FipeAdDecision {
  if (
    !input.last ||
    !lastFipeMatchesAd(input.last, {
      titulo: input.titulo,
      versao: input.versao,
      ano: input.ano,
    })
  ) {
    return { action: "none" };
  }
  const supplied = String(input.suppliedFipe ?? "").trim();
  if (!supplied) {
    return {
      action: "use_last",
      value: input.last.price,
      referenceMonth: input.last.referenceMonth,
    };
  }
  const suppliedNumber = parseBrlValue(supplied);
  const queriedNumber = parseBrlValue(input.last.price);
  if (!suppliedNumber || !queriedNumber) return { action: "none" };
  const difference = Math.abs(suppliedNumber - queriedNumber) / queriedNumber;
  return difference > 0.05
    ? {
      action: "confirm",
      queriedValue: input.last.price,
      suppliedValue: supplied,
      referenceMonth: input.last.referenceMonth,
    }
    : { action: "none" };
}
