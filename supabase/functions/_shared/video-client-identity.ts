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

function normalizedIntent(value: unknown): string {
  return compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type CreativeMediaRequest = "video" | "image" | "ambiguous" | null;

export function classifyCreativeMediaRequest(text: string): CreativeMediaRequest {
  const normalized = normalizedIntent(text)
    .replace(/^jarvis[,.!:\s-]*/, "")
    .replace(/^por favor[,.!:\s-]*/, "")
    .trim();
  const creation = /\b(faz|faca|fazer|cria|criar|crie|monta|monte|gera|gere|produz|produza|quero|preciso)\b/
    .test(normalized);
  if (!creation) return null;

  const explicitImageLead =
    /^(?:(?:eu\s+)?quero\s+(?:que\s+voce\s+)?)?(?:faz|faca|fazer|cria|criar|crie|monta|monte|gera|gere|produz|produza)\s+(?:uma?\s+)?(?:arte|imagem|foto|banner|card|post\s+estatico)\b/
      .test(normalized);
  if (explicitImageLead) return "image";
  const explicitVideoLead =
    /^(?:(?:eu\s+)?quero\s+(?:que\s+voce\s+)?)?(?:faz|faca|fazer|cria|criar|crie|monta|monte|gera|gere|produz|produza)\s+(?:uma?\s+)?(?:video|motion|animacao|reels?\s+animado)\b/
      .test(normalized);
  if (explicitVideoLead) return "video";

  const image = /\b(arte|imagem|foto|banner|card|post\s+estatico)\b/.test(normalized);
  const video = /\b(video|motion|animacao|animacoes|animado|animada|reels?\s+animado)\b/
    .test(normalized);
  if (image && video) return "ambiguous";
  if (image) return "image";
  if (video) return "video";
  return null;
}

export function isVideoMotionRequest(text: string): boolean {
  const mediaRequest = classifyCreativeMediaRequest(text);
  if (mediaRequest === "image" || mediaRequest === "ambiguous") return false;
  const normalized = normalizedIntent(text);
  const requestsExistingVideoDelivery =
    /\b(postar|publicar|posta|publica|agendar|agenda|mandar|manda|enviar|envia)\b/
      .test(normalized) &&
    (
      /\b(?:esse|este)\s+(?:ultimo\s+)?video\b|\b(?:o\s+)?ultimo\s+video\b/
        .test(normalized) ||
      /\b(?:id\s+da\s+midia\s*:?\s*)?[a-f0-9]{8}(?:-[a-f0-9-]{27,})?\b/i
        .test(normalized)
    );
  if (requestsExistingVideoDelivery) return false;
  const requestedCreation =
    /\b(faz|faca|fazer|cria|criar|crie|monta|monte|gera|gere|produz|produza|quero|preciso)\b/
      .test(normalized);
  const requestedMotion =
    /\b(video|motion|animacao|animacoes|animado|animada|reels? animado)\b/
      .test(normalized);
  return requestedCreation && requestedMotion;
}

export function shouldStartVideoSetup(text: string): boolean {
  const mediaRequest = classifyCreativeMediaRequest(text);
  if (mediaRequest === "image" || mediaRequest === "ambiguous") return false;
  if (isVideoMotionRequest(text)) return true;
  const normalized = normalizedIntent(text);
  const sceneCount = normalized.match(/\bcena\s*\d+\b/g)?.length ?? 0;
  const isVideoScript = /\broteiros?\b/.test(normalized) &&
    /\b(video|motion|animad[oa]s?|cenas?)\b/.test(normalized);
  return isVideoScript || sceneCount >= 2;
}

export function isClearlyDifferentFromPendingVideo(text: string): boolean {
  if (/<<INTERACTIVE_ID:video_/i.test(String(text))) return false;
  const mediaRequest = classifyCreativeMediaRequest(text);
  if (mediaRequest === "image" || mediaRequest === "ambiguous") return true;
  const normalized = normalizedIntent(text);
  return /\b(?:cria|criar|crie|faz|fazer|faca|gera|gerar|gere|monta|montar|monte|quero|preciso)\b/
      .test(normalized) &&
    /\b(?:anuncio\s+pago|campanha\s+de\s+anuncios|meta\s+ads|facebook\s+ads|instagram\s+ads|trafego\s+pago|relatorio|carrossel|texto|legenda)\b/
      .test(normalized);
}

export function isVideoMotionRedoRequest(text: string): boolean {
  const normalized = normalizedIntent(text);
  const redo = /\b(refaz|refazer|fazer de novo|faz de novo|corrig[ei]|corrige|ajusta|ajustar|troca|trocar|muda|mudar)\b/
    .test(normalized);
  const video = /\b(video|roteiro|cena|titulo|destaque|fundo)\b/.test(
    normalized,
  );
  return redo && video;
}

export function hasUsableVideoTopic(topic: string): boolean {
  const normalized = normalizedIntent(topic);
  return normalized.length >= 4 &&
    !/^(?:(?:video|animado|motion)\s+)*(?:de\s+)?\d{1,3}(?:[,.]\d+)?\s*(?:s|seg(?:undo)?s?|min(?:uto)?s?)$/
      .test(normalized);
}

export function clientLogoUploadFollowUp(
  clientName: string,
  errorCode: string,
): string | null {
  if (errorCode !== "foto_ausente" && errorCode !== "foto_expirada") {
    return null;
  }
  return `Envie a logo do ${
    compact(clientName)
  } agora em PNG, JPEG ou WEBP. Assim que receber a imagem, vou cadastrá-la automaticamente. Se preferir desistir, responda *cancelar*.`;
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
  const compactText = compact(text);
  const wordCount = compactText ? compactText.split(/\s+/u).length : 0;
  const lineCount = text.split(/\r?\n/u).filter((line) => line.trim()).length;
  const normalizedText = normalizedIntent(compactText);
  if (
    wordCount > 25 ||
    lineCount > 1 ||
    /\b(?:videos?|motion|animac(?:ao|oes)|animad[oa]s?|roteiros?|cenas?|carrosseis?|posts?|imagens?)\b/u
      .test(normalizedText)
  ) {
    return false;
  }
  return /\b(?:logo|logomarca|logotipo)\b/i.test(text) &&
    /\b(?:guard(?:a|ar|e)|salv(?:a|ar|e)|registr(?:a|ar|e)|cadastr(?:a|ar|e)|us(?:a|e|ar)\s+(?:essa|esse|esta|este|isso)|esse\s+e|essa\s+e|isto\s+e|usar\s+(?:nos?|em)\s+(?:videos?|posts?))\b/i
      .test(
        normalizedText,
      );
}
