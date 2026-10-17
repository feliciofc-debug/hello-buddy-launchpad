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
