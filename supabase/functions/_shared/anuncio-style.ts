import type { ClientBrandIdentity } from "./client-brand-identity.ts";

export type AnuncioStyle = "impacto" | "catalogo" | "destaque";
export const ANUNCIO_STYLES: AnuncioStyle[] = [
  "impacto",
  "catalogo",
  "destaque",
];

export function anuncioStyleFromText(text: string): AnuncioStyle | null {
  const value = String(text || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const style of ANUNCIO_STYLES) {
    if (
      new RegExp(
        `\\b(?:estilo|molde|modelo)\\s+${style}\\b|\\bno\\s+(?:estilo\\s+)?${style}\\b`,
      ).test(value)
    ) {
      return style;
    }
  }
  return null;
}

export function anuncioStyleButtons() {
  return {
    body: "Qual você prefere?",
    buttons: [
      { id: "anuncio_style:impacto", title: "Impacto" },
      { id: "anuncio_style:catalogo", title: "Catálogo" },
      { id: "anuncio_style:destaque", title: "Destaque" },
    ],
  };
}

export function otherAnuncioStyles(style: AnuncioStyle): AnuncioStyle[] {
  return ANUNCIO_STYLES.filter((item) => item !== style);
}

export function savedClientAnuncioStyle(
  identity: ClientBrandIdentity | null | undefined,
): AnuncioStyle | null {
  const value = String(identity?.identity?.preferred_ad_style || "");
  return ANUNCIO_STYLES.includes(value as AnuncioStyle)
    ? value as AnuncioStyle
    : null;
}

export async function getTenantAnuncioStyle(
  sb: any,
  userId: string,
): Promise<AnuncioStyle | null> {
  const { data } = await sb.from("empresa_config")
    .select("identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  const value = String(data?.identidade_site?.preferred_ad_style || "");
  return ANUNCIO_STYLES.includes(value as AnuncioStyle)
    ? value as AnuncioStyle
    : null;
}

export async function saveTenantAnuncioStyle(
  sb: any,
  userId: string,
  style: AnuncioStyle,
): Promise<void> {
  const { data } = await sb.from("empresa_config")
    .select("identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  const identity = data?.identidade_site &&
      typeof data.identidade_site === "object"
    ? data.identidade_site
    : {};
  const { error } = await sb.from("empresa_config").upsert({
    user_id: userId,
    identidade_site: { ...identity, preferred_ad_style: style },
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
