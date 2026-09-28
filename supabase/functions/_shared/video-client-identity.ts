export type AutomaticVideoSiteIdentity = {
  clientName: string;
  colors: string[];
  useSiteLogo: boolean;
  summary: string;
};

function compact(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedBrand(value: unknown): string {
  return compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanVideoClientCandidate(value: string): string | null {
  const name = compact(value)
    .replace(/^(?:a|o|cliente|empresa|marca)\s+/i, "")
    .replace(
      /\s+(?:sobre|falando|para\s+divulgar|com|usando|formato\s+(?:vertical|horizontal|quadrado)|para\s+(?:reels?|stories?|feed))\b.*$/i,
      "",
    )
    .replace(/[,.;:].*$/, "")
    .trim();
  const normalized = normalizedBrand(name);
  if (
    name.length < 2 ||
    name.length > 100 ||
    /^(?:minha|nossa|cliente|empresa|marca|whatsapp|instagram|facebook)$/i.test(
      name,
    ) ||
    /^(?:\d+\s*)?(?:s|segundos?|minutos?|vertical|horizontal|quadrado|reels?|stories?|feed)$/i
      .test(name) ||
    /^(?:consorcio|imovel|produto|servico|campanha|divulgacao)$/.test(
      normalized,
    )
  ) {
    return null;
  }
  return name;
}

export function extractVideoClientName(text: string): string | null {
  const input = compact(text);
  if (!/\bv[ií]deo\b/i.test(input)) return null;

  const candidates: Array<{ name: string; priority: number }> = [];
  const preferred =
    /\b(da|do|para\s+a|para\s+o)\s+(.+?)(?=\s+(?:sobre|falando|para\s+divulgar|com|usando|formato\s+(?:vertical|horizontal|quadrado)|para\s+(?:reels?|stories?|feed))\b|[,.;:]|\s+https?:\/\/|\s+www\.|$)/giu;
  for (const match of input.matchAll(preferred)) {
    const name = cleanVideoClientCandidate(match[2]);
    if (name) {
      candidates.push({
        name,
        priority: /^d[ao]$/i.test(match[1]) ? 2 : 1,
      });
    }
  }

  if (!candidates.length) {
    const afterVideo = input.match(
      /\bv[ií]deo(?:\s+(?:animado|motion|institucional|publicit[aá]rio)){0,3}\s+de\s+(.+?)(?=\s+(?:sobre|falando|para\s+divulgar|com|usando|formato|para\s+(?:reels?|stories?|feed))\b|[,.;:]|$)/iu,
    );
    const name = cleanVideoClientCandidate(afterVideo?.[1] ?? "");
    if (name) candidates.push({ name, priority: 0 });
  }

  if (!candidates.length) return null;
  const highestPriority = Math.max(
    ...candidates.map((candidate) => candidate.priority),
  );
  const best = candidates.filter((candidate) =>
    candidate.priority === highestPriority
  );
  const unique = new Map(
    best.map((candidate) => [normalizedBrand(candidate.name), candidate.name]),
  );
  return unique.size === 1 ? [...unique.values()][0].slice(0, 100) : null;
}

export function isSameVideoBrandName(
  requestedName: string | null | undefined,
  tenantBrandName: string | null | undefined,
): boolean {
  const requested = normalizedBrand(requestedName);
  const tenant = normalizedBrand(tenantBrandName);
  return Boolean(requested && tenant && requested === tenant);
}

export function selectVideoClientLogo(input: {
  manualLogoPath?: string | null;
  siteLogoPath?: string | null;
  withoutLogo?: boolean;
}): {
  path?: string;
  source: "whatsapp_manual" | "site_high_confidence" | "none";
} {
  if (input.withoutLogo) return { source: "none" };
  if (input.manualLogoPath) {
    return { path: input.manualLogoPath, source: "whatsapp_manual" };
  }
  if (input.siteLogoPath) {
    return { path: input.siteLogoPath, source: "site_high_confidence" };
  }
  return { source: "none" };
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
  const clientName = compact(input.requestedClientName) ||
    compact(input.siteBrandName) ||
    videoSiteDomain(input.siteUrl);
  const colors = [
    ...new Set(
      (input.colors ?? [])
        .map((color) => String(color).toLowerCase())
        .filter((color) => /^#[0-9a-f]{6}$/.test(color)),
    ),
  ];
  const useSiteLogo = input.logoConfidence === "high" &&
    Boolean(input.logoDataUrl);
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
  return /\b(?:logo|logomarca|logotipo)\b/i.test(text) &&
    /\b(?:guard(?:a|ar|e)|salv(?:a|ar|e)|registr(?:a|ar|e)|cadastr(?:a|ar|e)|us(?:a|e|ar)\s+(?:essa|esse|esta|este|isso)|esse\s+(?:e|é)|essa\s+(?:e|é)|isto\s+(?:e|é)|usar\s+(?:nos?|em)\s+(?:videos?|vídeos?|posts?))\b/i
      .test(
        text,
      );
}
