export interface VideoLegendaLogoAsset {
  bucket: string;
  path: string;
  lightBackgroundPath?: string;
  darkBackgroundPath?: string;
}

export const VIDEO_LEGENDA_LOGO_BUTTONS = [
  { id: "video_legenda_com_logo", title: "Gerar com logo" },
  { id: "video_legenda_sem_logo", title: "Gerar sem logo" },
] as const;

export function botoesLegendaParaLogo(
  logo: VideoLegendaLogoAsset | null | undefined,
): Array<{ id: string; title: string }> | null {
  return logo ? VIDEO_LEGENDA_LOGO_BUTTONS.map((button) => ({ ...button })) : null;
}

/** true = com logo; false = sem logo/padrão atual; null = não decidiu. */
export function detectarEscolhaLogo(texto: string): boolean | null {
  const t = texto || "";
  if (/<<INTERACTIVE_ID:video_legenda_com_logo>>/i.test(t) || /\bcom\s+(a\s+)?logo\b/i.test(t)) {
    return true;
  }
  if (
    /<<INTERACTIVE_ID:video_legenda_sem_logo>>/i.test(t) ||
    /\bsem\s+(a\s+)?logo\b/i.test(t)
  ) {
    return false;
  }
  return null;
}

export function metadataEscolhaLogo(
  metadata: Record<string, unknown> | null | undefined,
  texto: string,
  logo?: VideoLegendaLogoAsset | null,
): Record<string, unknown> {
  const escolha = detectarEscolhaLogo(texto);
  return {
    ...(metadata || {}),
    com_logo: escolha === true,
    ...(logo?.lightBackgroundPath
      ? { logo_light_background_path: logo.lightBackgroundPath }
      : {}),
    ...(logo?.darkBackgroundPath
      ? { logo_dark_background_path: logo.darkBackgroundPath }
      : {}),
  };
}
