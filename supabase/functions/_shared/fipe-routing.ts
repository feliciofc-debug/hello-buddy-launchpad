import {
  type FipeLookupInput,
  normalizeFipeYear,
  parseFipeRequestText,
} from "./fipe-input.ts";

export type ConfirmedVehicleForFipe = {
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
} | null | undefined;

export function isExplicitFipeRequest(text: unknown): boolean {
  const value = String(text ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:fipe|tabela\s+fipe|consult(?:a|ar|e)\s+(?:a\s+)?fipe|cot(?:a|ar|e)\s+(?:a\s+)?fipe|quanto\s+val(?:e|eria)\s+(?:na|pela)\s+fipe)\b/
    .test(value);
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

export function vehicleFipeTurn(
  text: string,
  input: FipeLookupInput,
  hasPendingFipe = false,
): "fipe_pending" | "fipe_ask_year" | "fipe_lookup" | "vehicle_flow" {
  if (hasPendingFipe) return "fipe_pending";
  if (!isExplicitFipeRequest(text)) return "vehicle_flow";
  if (input.marca && input.modelo && !input.ano_modelo) {
    return "fipe_ask_year";
  }
  return "fipe_lookup";
}
