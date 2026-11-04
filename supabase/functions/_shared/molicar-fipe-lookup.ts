import {
  createFipeClient,
  type FipeClient,
  type FipeListItem,
  normalizeFipeText,
  rankFipeItems,
} from "./fipe.ts";
import {
  filterFipeModelCandidates,
  filterFipeYearCandidates,
  normalizeFipeEngine,
  normalizeFipeTransmission,
  normalizeFipeYear,
} from "./fipe-input.ts";
export type MolicarFipeStrictQuote = {
  price: string;
  referenceMonth: string;
  source: "fipe_publica";
};

export const MOLICAR_PLATE_FIPE_TIMEOUT_MS = 6_000;

export type MolicarFipeStrictOmit = "ambiguo" | "sem_match";

export type MolicarFipeStrictLookupInput = {
  marca?: unknown;
  modelo?: unknown;
  versao?: unknown;
  ano_modelo?: unknown;
  combustivel?: unknown;
  vehicleType?: "cars" | "motorcycles" | "trucks";
};

function fipeFuelCode(fuel: unknown): "1" | "2" | "3" | null {
  const normalized = normalizeFipeText(String(fuel ?? ""));
  if (/\bDIESEL\b/.test(normalized)) return "3";
  if (/\bALCOOL\b|\bETANOL\b/.test(normalized)) return "2";
  if (/\bGASOLINA\b|\bFLEX\b/.test(normalized)) return "1";
  return null;
}

function fuelLabel(fuel: unknown): string | undefined {
  const normalized = normalizeFipeText(String(fuel ?? ""));
  if (/\bDIESEL\b/.test(normalized)) return "DIESEL";
  if (/\bALCOOL\b|\bETANOL\b/.test(normalized)) return "ALCOOL";
  if (/\bGASOLINA\b/.test(normalized)) return "GASOLINA";
  if (/\bFLEX\b/.test(normalized)) return "FLEX";
  return undefined;
}

function strictBrandMatch(
  brands: FipeListItem[],
  marca: string,
): FipeListItem | null {
  const expected = normalizeFipeText(marca);
  const matches = brands.filter((brand) =>
    normalizeFipeText(brand.name) === expected
  );
  return matches.length === 1 ? matches[0] : null;
}

function vehicleMatchText(input: MolicarFipeStrictLookupInput): string {
  return [input.modelo, input.versao].filter(Boolean).map(String).join(" ")
    .trim();
}

function modelQueryFromVehicle(input: MolicarFipeStrictLookupInput): string {
  return normalizeFipeText(vehicleMatchText(input));
}

function filterSpec(input: MolicarFipeStrictLookupInput) {
  const combined = [input.modelo, input.versao].filter(Boolean).map(String)
    .join(" ");
  return {
    motor: normalizeFipeEngine(combined),
    cambio: normalizeFipeTransmission(combined),
  };
}

function modelScore(query: string, candidate: string): number {
  const q = normalizeFipeText(query);
  const c = normalizeFipeText(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1000;
  let score = c.includes(q) ? 500 - Math.max(0, c.length - q.length) : 0;
  const queryTokens = q.split(" ").filter((token) => token.length > 1);
  const candidateTokens = new Set(c.split(" "));
  const matched =
    queryTokens.filter((token) => candidateTokens.has(token)).length;
  score += matched * 50;
  if (matched === queryTokens.length) score += 100;
  return score;
}

type StrictCandidate = {
  model: FipeListItem;
  score: number;
  yearId: string;
};

export async function lookupFipeStrictByVehicleIdentity(
  input: MolicarFipeStrictLookupInput,
  client: FipeClient = createFipeClient({
    timeoutMs: MOLICAR_PLATE_FIPE_TIMEOUT_MS,
  }),
): Promise<
  | { ok: true; quote: MolicarFipeStrictQuote }
  | { ok: false; omit: MolicarFipeStrictOmit }
> {
  const marca = String(input.marca ?? "").trim();
  const modelYear = normalizeFipeYear(String(input.ano_modelo ?? ""));
  const fuelCode = fipeFuelCode(input.combustivel);
  const query = modelQueryFromVehicle(input);
  if (!marca || !modelYear || !fuelCode || !query) {
    return { ok: false, omit: "sem_match" };
  }

  const brand = strictBrandMatch(await client.listarMarcas(), marca);
  if (!brand) return { ok: false, omit: "sem_match" };

  const matchText = vehicleMatchText(input);
  const ranked = rankFipeItems(
    await client.listarModelosPorAno(brand.code, modelYear, matchText),
    matchText,
  );
  const filteredModels = filterFipeModelCandidates(ranked, filterSpec(input));
  const fuelName = fuelLabel(input.combustivel);
  const strictCandidates: StrictCandidate[] = [];

  for (const model of filteredModels.slice(0, 12)) {
    const years = filterFipeYearCandidates(
      await client.listarAnos(brand.code, model.code),
      modelYear,
      fuelName,
    );
    for (const year of years) {
      if (!String(year.code).endsWith(`-${fuelCode}`)) continue;
      strictCandidates.push({
        model,
        score: modelScore(matchText, model.name),
        yearId: year.code,
      });
    }
  }

  if (!strictCandidates.length) return { ok: false, omit: "sem_match" };

  strictCandidates.sort((a, b) =>
    b.score - a.score || a.model.name.localeCompare(b.model.name, "pt-BR")
  );
  const queryTokens = normalizeFipeText(matchText).split(" ").filter((token) =>
    token.length > 1
  );
  const minScore = Math.max(
    100,
    Math.min(260, queryTokens.length * 28),
  );
  const viable = strictCandidates.filter((candidate) =>
    candidate.score >= minScore
  );
  if (!viable.length) return { ok: false, omit: "sem_match" };
  const best = viable[0];
  const second = viable[1];
  if (second && best.score - second.score < 70) {
    return { ok: false, omit: "ambiguo" };
  }

  const price = await client.consultarPreco({
    brandId: brand.code,
    modelId: best.model.code,
    yearId: best.yearId,
    vehicleType: input.vehicleType ?? "cars",
  });
  if (
    !String(price.price || "").trim() ||
    !String(price.referenceMonth || "").trim()
  ) {
    return { ok: false, omit: "sem_match" };
  }
  return {
    ok: true,
    quote: {
      price: String(price.price).trim(),
      referenceMonth: String(price.referenceMonth).trim(),
      source: "fipe_publica",
    },
  };
}
