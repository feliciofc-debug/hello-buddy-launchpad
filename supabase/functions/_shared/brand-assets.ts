import {
  extractDominantLogoColorsFromBytes,
} from "./brand-image-engine.ts";
import {
  getTenantLogoDataUrl,
  getTenantLogoDataUrlForBackground,
} from "./tenant-logo.ts";

export type TenantBrandAssets = {
  logoDataUrl: string | null;
  logoForLightBackgroundDataUrl: string | null;
  logoForDarkBackgroundDataUrl: string | null;
  colors: string[];
  brandName: string | null;
};

export function dataUrlToImageBytes(
  value: string | null | undefined,
): { bytes: Uint8Array; mime: string } | null {
  const match = String(value || "").match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml));base64,([\s\S]+)$/i,
  );
  if (!match) return null;
  try {
    return {
      bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)),
      mime: match[1].toLowerCase().replace("image/jpg", "image/jpeg"),
    };
  } catch {
    return null;
  }
}

function collectHexColors(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    const matches = value.match(/#[0-9a-f]{6}\b/gi) ?? [];
    output.push(...matches.map((color) => color.toLowerCase()));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectHexColors(entry, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectHexColors(entry, output);
    }
  }
}

function isUsefulBrandColor(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const saturation = max === min
    ? 0
    : ((max + min) / 2 > 0.5
      ? (max - min) / (2 - max - min)
      : (max - min) / (max + min));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return saturation >= 0.16 && luminance >= 0.06 && luminance <= 0.95;
}

export function normalizeSavedBrandColors(value: unknown): string[] {
  const colors: string[] = [];
  collectHexColors(value, colors);
  return [...new Set(colors)].filter(isUsefulBrandColor).slice(0, 4);
}

function colorsFromSvg(bytes: Uint8Array): string[] {
  try {
    return normalizeSavedBrandColors(new TextDecoder().decode(bytes));
  } catch {
    return [];
  }
}

export async function colorsFromLogoDataUrl(dataUrl: string | null): Promise<string[]> {
  const decoded = dataUrlToImageBytes(dataUrl);
  if (!decoded) return [];
  if (decoded.mime === "image/svg+xml") return colorsFromSvg(decoded.bytes);
  return await extractDominantLogoColorsFromBytes(decoded.bytes);
}

export async function loadTenantBrandAssets(
  supabase: any,
  userId: string,
  options: { includeLogo?: boolean } = {},
): Promise<TenantBrandAssets> {
  const [logoDataUrl, logoForLightBackgroundDataUrl, logoForDarkBackgroundDataUrl] =
    options.includeLogo === false
      ? [null, null, null]
      : await Promise.all([
        getTenantLogoDataUrl(supabase, userId),
        getTenantLogoDataUrlForBackground(supabase, userId, "light"),
        getTenantLogoDataUrlForBackground(supabase, userId, "dark"),
      ]);
  const { data, error } = await supabase
    .from("empresa_config")
    .select("nome_empresa, paleta_marca, identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[brand-assets] identidade indisponível:", error.message);
  }
  const identity = data?.identidade_site && typeof data.identidade_site === "object"
    ? data.identidade_site as Record<string, unknown>
    : {};
  let colors = normalizeSavedBrandColors(data?.paleta_marca);
  if (!colors.length) colors = normalizeSavedBrandColors(identity.paleta);
  if (!colors.length && logoDataUrl) colors = await colorsFromLogoDataUrl(logoDataUrl);
  let brandName = String(data?.nome_empresa || "").trim() || null;
  if (!brandName) {
    try {
      const { data: whatsapp } = await supabase
        .from("whatsapp_config")
        .select("business_name")
        .eq("user_id", userId)
        .maybeSingle();
      brandName = String(whatsapp?.business_name || "").trim() || null;
    } catch {
      // Nome é um reforço de grafia; sua ausência não pode misturar tenants.
    }
  }
  return {
    logoDataUrl,
    logoForLightBackgroundDataUrl,
    logoForDarkBackgroundDataUrl,
    colors,
    brandName,
  };
}
