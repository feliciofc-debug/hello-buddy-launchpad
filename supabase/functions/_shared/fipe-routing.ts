import {
  filterFipeYearCandidates,
  type FipeLookupInput,
  normalizeFipeYear,
  parseFipeRequestText,
  parseFipeRequestTextWithBrands,
} from "./fipe-input.ts";
import type { FipeListItem } from "./fipe.ts";

export type ConfirmedVehicleForFipe =
  | {
    confirmed?: boolean;
    confirmed_title?: string;
    identification?: {
      marca?: string | null;
      modelo?: string | null;
    } | null;
    data?: {
      titulo?: string;
      ano?: string;
      versao?: string;
      motor?: string;
      cambio?: string;
    } | null;
  }
  | null
  | undefined;

export function isExplicitFipeRequest(text: unknown): boolean {
  const value = String(text ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:fipe|fipi|fip|tabela\s+fipe|consult(?:a|ar|e)\s+(?:a\s+)?fipe|cot(?:a|ar|e)\s+(?:a\s+)?fipe|quanto\s+val(?:e|eria)\s+(?:na|pela)\s+fipe)\b/
    .test(value);
}

export function isFipePhotoReference(text: unknown): boolean {
  const value = String(text ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:da|dessa|desta|na|nessa|nesta)\s+(?:imagem|foto)\b|\b(?:desse|deste|do)\s+(?:carro|veiculo)\s+(?:da|dessa|desta)\s+(?:imagem|foto)\b/
    .test(value);
}

export function resolveFipePhotoSource(input: {
  text: string;
  hasCurrentPhoto: boolean;
  hasRecentPhoto: boolean;
}): "current" | "recent" | "none" {
  if (input.hasCurrentPhoto) return "current";
  if (isFipePhotoReference(input.text) && input.hasRecentPhoto) return "recent";
  return "none";
}

export function createFipePriceRetryState(input: {
  brand: FipeListItem;
  model: FipeListItem;
  year: FipeListItem;
  queryModel: string;
  createdAt?: string;
}) {
  return {
    stage: "price_retry" as const,
    brand: input.brand,
    model: input.model,
    year: input.year,
    queryModel: input.queryModel,
    created_at: input.createdAt || new Date().toISOString(),
  };
}

export function fipeYearDecision(years: FipeListItem[]):
  | { action: "price"; year: FipeListItem }
  | { action: "choose"; years: FipeListItem[] }
  | { action: "none" } {
  if (years.length === 1) return { action: "price", year: years[0] };
  if (years.length > 1) return { action: "choose", years };
  return { action: "none" };
}

export function fipeYearAvailabilityDecision(
  availableYears: FipeListItem[],
  requestedYear?: string,
  requestedFuel?: string,
):
  | { action: "price"; year: FipeListItem }
  | { action: "choose"; years: FipeListItem[] }
  | { action: "requested_unavailable"; years: FipeListItem[] }
  | { action: "none" } {
  const matchingYears = requestedYear || requestedFuel
    ? filterFipeYearCandidates(
      availableYears,
      requestedYear,
      requestedFuel,
    )
    : availableYears;
  const decision = fipeYearDecision(matchingYears);
  if (
    decision.action === "none" && requestedYear && availableYears.length > 0
  ) {
    return { action: "requested_unavailable", years: availableYears };
  }
  return decision;
}

export function fipeModelDecision(models: FipeListItem[]):
  | { action: "continue"; model: FipeListItem }
  | { action: "choose"; models: FipeListItem[] }
  | { action: "none" } {
  if (models.length === 1) return { action: "continue", model: models[0] };
  if (models.length > 1) return { action: "choose", models };
  return { action: "none" };
}

export type FipeModelsByYearResult =
  | {
    status: "filtered";
    models: FipeListItem[];
    availableYears: FipeListItem[];
  }
  | { status: "fallback"; models: FipeListItem[] };

export async function filterFipeModelsByYear(
  models: FipeListItem[],
  requestedYear: string,
  listYears: (modelId: string) => Promise<FipeListItem[]>,
  options: { maxCandidates?: number; timeoutMs?: number } = {},
): Promise<FipeModelsByYearResult> {
  const candidates = models.slice(0, options.maxCandidates ?? 15);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("fipe_year_filter_timeout")),
        options.timeoutMs ?? 8_000,
      );
    });
    const entries = await Promise.race([
      Promise.all(
        candidates.map(async (model) => ({
          model,
          years: await listYears(model.code),
        })),
      ),
      timeout,
    ]);
    const availableYears: FipeListItem[] = [];
    const seenYears = new Set<string>();
    const matchingModels: FipeListItem[] = [];
    for (const entry of entries) {
      if (filterFipeYearCandidates(entry.years, requestedYear).length > 0) {
        matchingModels.push(entry.model);
      }
      for (const year of entry.years) {
        const key = `${year.code}:${year.name}`;
        if (!seenYears.has(key)) {
          seenYears.add(key);
          availableYears.push(year);
        }
      }
    }
    return {
      status: "filtered",
      models: matchingModels,
      availableYears,
    };
  } catch {
    return { status: "fallback", models };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function fipeInputFromConfirmedVehicle(
  text: string,
  pending: ConfirmedVehicleForFipe,
): FipeLookupInput {
  const parsed = parseFipeRequestText(text);
  if (!pending?.confirmed) return parsed;
  const title = String(
    pending.confirmed_title || pending.data?.titulo || "",
  ).trim();
  const brand = String(pending.identification?.marca || "").trim();
  const model = String(pending.identification?.modelo || "").trim();
  const titleWithoutBrand = brand &&
      title.toLowerCase().startsWith(brand.toLowerCase())
    ? title.slice(brand.length).trim()
    : title;
  return {
    ...parsed,
    marca: parsed.marca || brand || undefined,
    modelo: parsed.modelo || model || titleWithoutBrand || undefined,
    versao: parsed.versao || pending.data?.versao || undefined,
    ano_modelo: parsed.ano_modelo ||
      normalizeFipeYear(pending.data?.ano),
    motor: parsed.motor || pending.data?.motor || undefined,
    cambio: parsed.cambio ||
      (/aut/i.test(String(pending.data?.cambio || ""))
        ? "automatico"
        : /man|mec/i.test(String(pending.data?.cambio || ""))
        ? "manual"
        : undefined),
  };
}

export function fipeInputFromTextAndBrands(
  text: string,
  pending: ConfirmedVehicleForFipe,
  brands: FipeListItem[],
): FipeLookupInput {
  const confirmed = fipeInputFromConfirmedVehicle(text, pending);
  if (confirmed.marca && confirmed.modelo) return confirmed;
  const generic = parseFipeRequestTextWithBrands(text, brands);
  return {
    ...confirmed,
    marca: confirmed.marca || generic.marca,
    modelo: confirmed.modelo || generic.modelo,
    ano_modelo: confirmed.ano_modelo || generic.ano_modelo,
    versao: confirmed.versao || generic.versao,
    combustivel: confirmed.combustivel || generic.combustivel,
    cambio: confirmed.cambio || generic.cambio,
    motor: confirmed.motor || generic.motor,
  };
}

export function vehicleFipeTurn(
  text: string,
  input: FipeLookupInput,
  hasPendingFipe = false,
): "fipe_pending" | "fipe_ai" | "fipe_lookup" | "vehicle_flow" {
  if (hasPendingFipe) return "fipe_pending";
  if (!isExplicitFipeRequest(text)) return "vehicle_flow";
  return input.marca && input.modelo ? "fipe_lookup" : "fipe_ai";
}
