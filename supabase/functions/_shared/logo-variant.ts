export type LogoBackground = "light" | "dark";
export type LogoVariant = "default" | "light_background" | "dark_background";

export function logoVariantForBackground(
  background: LogoBackground,
): LogoVariant {
  return background === "light" ? "light_background" : "dark_background";
}

export function logoBackgroundFromLuminance(luminance: number): LogoBackground {
  return Number.isFinite(luminance) && luminance >= 0.52 ? "light" : "dark";
}

export function pickLogoVariant<T>(
  logos: Partial<Record<LogoVariant, T | null | undefined>>,
  background: LogoBackground,
): T | null {
  return logos[logoVariantForBackground(background)] ?? logos.default ?? null;
}

export function detectLogoVariantRequest(text: string): LogoVariant | null {
  const normalized = String(text || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(?:logo|logomarca|logotipo)\b/.test(normalized)) return null;
  if (/\bfundo\s+(?:claro|branco)\b/.test(normalized)) {
    return "light_background";
  }
  if (/\bfundo\s+(?:escuro|preto)\b/.test(normalized)) {
    return "dark_background";
  }
  return null;
}
