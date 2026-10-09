import type { ClientBrandIdentity } from "./client-brand-identity.ts";

export type AnuncioStyle = "impacto" | "catalogo" | "destaque";
export type AnuncioPhotoPreference = "melhorada" | "original";
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

export function anuncioPhotoDirectiveFromText(
  text: string,
): AnuncioPhotoPreference | null {
  const value = String(text || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (
    /\b(?:usa|usar|use|mantem|manter|mantenha)\s+(?:a\s+)?foto\s+como\s+(?:ela\s+)?esta\b/
      .test(value) ||
    /\bsem\s+(?:melhorar|editar|alterar)(?:\s+(?:a\s+)?foto)?\b/
      .test(value) ||
    /\bsem\s+mexer\s+n[oa]\s+foto\b/
      .test(value) ||
    /\bfoto\s+original\b/.test(value)
  ) {
    return "original";
  }
  if (
    /\b(?:melhora|melhorar|melhore)\b[\s\S]{0,40}\b(?:fundo|luz|iluminacao|foto)\b/
      .test(value) ||
    /\b(?:fundo|luz|iluminacao)\b[\s\S]{0,40}\b(?:melhora|melhorar|melhore)\b/
      .test(value)
  ) {
    return "melhorada";
  }
  return null;
}

export function resolveAnuncioPhotoPreference(input: {
  explicit?: AnuncioPhotoPreference | null;
  saved?: AnuncioPhotoPreference | null;
}): AnuncioPhotoPreference | null {
  return input.explicit ?? input.saved ?? null;
}

export function shouldImproveAnuncioPhoto(
  preference: AnuncioPhotoPreference,
): boolean {
  return preference === "melhorada";
}

export function anuncioPhotoChoiceButtons() {
  return {
    body:
      "Como quer a foto do anúncio? Melhorar só muda fundo e luz; o veículo fica igual.",
    buttons: [
      { id: "anuncio_photo:melhorada", title: "Melhorar fundo e luz" },
      { id: "anuncio_photo:original", title: "Usar foto original" },
    ],
  };
}

export function anuncioPhotoRedoButtons(used: AnuncioPhotoPreference) {
  const target = used === "melhorada" ? "original" : "melhorada";
  return {
    body: "Quer comparar a outra versão da foto?",
    buttons: [{
      id: `anuncio_photo:redo:${target}`,
      title: target === "original" ? "Refazer original" : "Refazer melhorada",
    }],
  };
}

export function anuncioPhotoPreferenceConfirmationButtons(
  preference: AnuncioPhotoPreference,
) {
  return {
    body: "Quer usar sempre assim?",
    buttons: [
      {
        id: `anuncio_photo_pref:always:${preference}`,
        title: "Sim, sempre",
      },
      { id: "anuncio_photo_pref:once", title: "Só desta vez" },
    ],
  };
}

export function preferenceAfterPhotoRedo(input: {
  current: AnuncioPhotoPreference | null;
  used: AnuncioPhotoPreference;
  always: boolean;
}): AnuncioPhotoPreference | null {
  return input.always ? input.used : input.current;
}

export async function getTenantAnuncioPhotoPreference(
  sb: any,
  userId: string,
): Promise<AnuncioPhotoPreference | null> {
  const { data, error } = await sb.from("empresa_config")
    .select("identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const value = String(
    data?.identidade_site?.foto_anuncio_preferencia || "",
  );
  return value === "melhorada" || value === "original" ? value : null;
}

export async function saveTenantAnuncioPhotoPreference(
  sb: any,
  userId: string,
  preference: AnuncioPhotoPreference | null,
): Promise<void> {
  const { data, error: readError } = await sb.from("empresa_config")
    .select("identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const identity = data?.identidade_site &&
      typeof data.identidade_site === "object"
    ? data.identidade_site
    : {};
  const { error } = await sb.from("empresa_config").upsert({
    user_id: userId,
    identidade_site: {
      ...identity,
      foto_anuncio_preferencia: preference,
    },
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
