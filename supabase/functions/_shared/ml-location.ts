export type MlLocationJson = {
  source: "ml_user_profile" | "tenant_override";
  updated_at: string;
  location?: {
    address_line?: string;
    zip_code?: string;
    city?: { id: string; name?: string };
    state?: { id: string; name?: string };
    country?: { id: string; name?: string };
    neighborhood?: { id: string; name?: string };
  };
};

/** CEP brasileiro: 8 dígitos (aceita máscara). */
export function normalizeBrazilCep(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return digits;
}

export function formatBrazilCep(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 8) return digits;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

type MlLocRef = { id?: string | null; name?: string | null };

function readLocRef(value: unknown): MlLocRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const id = o.id != null ? String(o.id).trim() : "";
  const name = o.name != null ? String(o.name).trim() : "";
  if (!id && !name) return undefined;
  return { id: id || undefined, name: name || undefined };
}

/** Resposta GET /countries/BR/zip_codes/{cep} (e extended_attributes quando presente). */
export function parseMlZipCodeApiResponse(body: unknown): MlLocationJson | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const ext = root.extended_attributes as Record<string, unknown> | undefined;

  const zipRaw = String(root.zip_code ?? "").replace(/\D/g, "");
  const zip_code = zipRaw.length === 8 ? zipRaw : undefined;

  const city = readLocRef(root.city);
  const state = readLocRef(root.state);
  const country = readLocRef(root.country) ?? { id: "BR", name: "Brasil" };

  let neighborhood = readLocRef(root.neighborhood);
  if (!neighborhood?.id && ext?.neighborhood && typeof ext.neighborhood === "object") {
    neighborhood = readLocRef(ext.neighborhood) ?? neighborhood;
  }

  let cityName = city?.name;
  if (!cityName && ext?.city_name) cityName = String(ext.city_name).trim() || undefined;

  const cityId = city?.id ?? "";
  const stateId = state?.id ?? "";

  if (!cityId && !stateId && !cityName && !state?.name) return null;

  const loc: NonNullable<MlLocationJson["location"]> = {
    zip_code,
    country: { id: country.id ?? "BR", name: country.name ?? "Brasil" },
  };
  if (stateId || state?.name) {
    loc.state = { id: stateId, name: state?.name ?? undefined };
  }
  if (cityId || cityName) {
    loc.city = { id: cityId, name: cityName ?? undefined };
  }
  if (neighborhood?.id) {
    loc.neighborhood = { id: neighborhood.id, name: neighborhood.name };
  }

  return {
    source: "tenant_override",
    updated_at: new Date().toISOString(),
    location: loc,
  };
}

export function mlZipCodeLookupErrorMessage(status: number, payload: unknown): string {
  if (status === 404) return "CEP não encontrado. Confira os 8 dígitos e tente de novo.";
  const msg = payload && typeof payload === "object"
    ? String((payload as Record<string, unknown>).message ?? "")
    : "";
  if (msg.toLowerCase().includes("zip")) return "CEP inválido. Use o formato 00000-000.";
  return "Não foi possível consultar este CEP no Mercado Livre. Tente novamente.";
}

export function parseMlUserLocation(me: Record<string, unknown>): MlLocationJson | null {
  const addr = me.address as Record<string, unknown> | undefined;
  const city = addr?.city as Record<string, unknown> | string | undefined;
  const state = addr?.state as Record<string, unknown> | string | undefined;
  const cityId = typeof city === "object" && city ? String(city.id ?? "").trim() : "";
  const stateId = typeof state === "object" && state ? String(state.id ?? "").trim() : "";
  const cityName = typeof city === "string" ? city : String(city?.name ?? "").trim();
  const stateName = typeof state === "string" ? state : String(state?.state ?? state?.name ?? "").trim();

  if (!cityId && !cityName && !stateId && !stateName) return null;

  return {
    source: "ml_user_profile",
    updated_at: new Date().toISOString(),
    location: {
      address_line: String(addr?.address_line ?? addr?.address ?? "").trim() || undefined,
      zip_code: String(addr?.zip_code ?? "").trim() || undefined,
      country: { id: "BR", name: "Brasil" },
      city: { id: cityId, name: cityName || undefined },
      state: { id: stateId, name: stateName || undefined },
    },
  };
}

export function hasPublishableMlLocation(json: unknown): boolean {
  const loc = (json as MlLocationJson | null)?.location;
  if (!loc) return false;
  return !!(String(loc.city?.id ?? "").trim() && String(loc.state?.id ?? "").trim());
}

export function mlLocationForItem(json: unknown): Record<string, unknown> | null {
  const loc = (json as MlLocationJson | null)?.location;
  if (!hasPublishableMlLocation(json) || !loc) return null;
  const out: Record<string, unknown> = {
    country: loc.country ?? { id: "BR" },
    state: { id: loc.state!.id, name: loc.state!.name },
    city: { id: loc.city!.id, name: loc.city!.name },
  };
  if (loc.address_line) out.address_line = loc.address_line;
  if (loc.zip_code) out.zip_code = loc.zip_code;
  if (loc.neighborhood?.id) out.neighborhood = loc.neighborhood;
  return out;
}
