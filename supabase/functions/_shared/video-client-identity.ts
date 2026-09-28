export type AutomaticVideoSiteIdentity = {
  clientName: string;
  colors: string[];
  useSiteLogo: boolean;
  summary: string;
};

function compact(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function extractVideoClientName(text: string): string | null {
  const input = compact(text);
  const match = input.match(
    /\b(?:v[ií]deo)(?:\s+(?:animado|motion|institucional|publicit[aá]rio|para\s+(?:reels?|stories?|feed))){0,3}\s+(?:d[oa]|de|para\s+(?:a|o))\s+([^,.;:/]+?)(?=\s+(?:com|usando|pelo|pelo\s+site|para|em|no|na)\b|\s+https?:\/\/|\s+www\.|$)/i,
  );
  const name = compact(match?.[1])
    .replace(/^(?:cliente|empresa|marca)\s+/i, "")
    .replace(/\s+(?:com|usando)\s+(?:a\s+)?(?:logo|marca|identidade).*$/i, "")
    .trim();
  if (
    name.length < 2
    || /^(?:minha|nossa|cliente|empresa|marca|whatsapp|instagram|facebook)$/i.test(name)
  ) {
    return null;
  }
  return name.slice(0, 100);
}

export function videoSiteDomain(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./i, "");
  } catch {
    return compact(siteUrl) || "Cliente";
  }
}

export function resolveAutomaticVideoSiteIdentity(input: {
  requestedClientName?: string | null;
  siteBrandName?: string | null;
  siteUrl: string;
  colors?: string[];
  logoConfidence?: string | null;
  logoDataUrl?: string | null;
}): AutomaticVideoSiteIdentity {
  const clientName = compact(input.requestedClientName)
    || compact(input.siteBrandName)
    || videoSiteDomain(input.siteUrl);
  const colors = [...new Set(
    (input.colors ?? [])
      .map((color) => String(color).toLowerCase())
      .filter((color) => /^#[0-9a-f]{6}$/.test(color)),
  )];
  const useSiteLogo = input.logoConfidence === "high"
    && Boolean(input.logoDataUrl);
  const applied = [
    useSiteLogo ? "logo do site" : null,
    colors.length ? `cores ${colors.slice(0, 4).join(" · ")}` : null,
  ].filter(Boolean).join(" + ") || "paleta automática sem logo";

  return {
    clientName,
    colors,
    useSiteLogo,
    summary: `${clientName} — ${applied}`,
  };
}

export function canRunClientLogoRegistrationShortcut(input: {
  text: string;
  hasPendingVideoSetup: boolean;
}): boolean {
  if (input.hasPendingVideoSetup) return false;
  if (/<<INTERACTIVE_ID:(?:video_|brand_|social_)[^>]*>>/i.test(input.text)) {
    return false;
  }
  const text = String(input.text ?? "");
  return /\b(?:logo|logomarca|logotipo)\b/i.test(text)
    && /\b(?:guard(?:a|ar|e)|salv(?:a|ar|e)|registr(?:a|ar|e)|cadastr(?:a|ar|e)|us(?:a|e|ar)\s+(?:essa|esse|esta|este|isso)|esse\s+(?:e|é)|essa\s+(?:e|é)|isto\s+(?:e|é)|usar\s+(?:nos?|em)\s+(?:videos?|vídeos?|posts?))\b/i.test(
      text,
    );
}
