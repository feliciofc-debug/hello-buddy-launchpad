import type { ClientBrandIdentity } from "./client-brand-identity.ts";
import { clientLogoPath } from "./client-brand-identity.ts";

export type AnuncioBrandPlan =
  | { mode: "tenant" }
  | {
    mode: "client";
    businessName: string;
    logoPath: string;
    colors: string[];
  }
  | { mode: "extract_site"; businessName: string; site: string }
  | { mode: "missing"; businessName: string };

export function anuncioClientColors(
  identity: Record<string, unknown> | null | undefined,
): string[] {
  const raw = Array.isArray(identity?.colors)
    ? identity.colors
    : Array.isArray(identity?.paleta)
    ? identity.paleta
    : [];
  return [...new Set(
    raw.map((color: unknown) => String(color).toUpperCase())
      .filter((color: string) => /^#[0-9A-F]{6}$/.test(color)),
  )].slice(0, 8);
}

export function buildAnuncioBrandPlan(input: {
  clientName?: string | null;
  site?: string | null;
  saved?: ClientBrandIdentity | null;
  background?: "light" | "dark";
}): AnuncioBrandPlan {
  const businessName = String(input.clientName || "")
    .replace(/\s+/g, " ").trim().slice(0, 100);
  if (!businessName) return { mode: "tenant" };
  const saved = input.saved;
  const logoPath = clientLogoPath(saved, input.background);
  if (logoPath) {
    return {
      mode: "client",
      businessName: saved?.client_name || businessName,
      logoPath,
      colors: anuncioClientColors(saved?.identity),
    };
  }
  const site = String(input.site || input.saved?.site_url || "").trim();
  return site
    ? { mode: "extract_site", businessName, site }
    : { mode: "missing", businessName };
}
