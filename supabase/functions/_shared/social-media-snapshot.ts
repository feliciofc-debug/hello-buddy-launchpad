export type SocialMediaSnapshot = {
  midiaTipo?: "foto" | "video" | "carrossel";
  produto?: {
    imagem_url?: unknown;
    image_urls?: unknown;
    source?: unknown;
  } | null;
};

export type ExactSocialMedia = {
  ok: true;
  urls: string[];
  mediaType: "foto" | "video" | "carrossel";
  flow: string;
} | {
  ok: false;
  urls: [];
  mediaType: "foto" | "video" | "carrossel";
  flow: string;
  error: "midia_exata_ausente" | "carrossel_incompleto";
};

function cleanUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * Resolves only the immutable media snapshot persisted with an approval token.
 * It deliberately has no fallback to conversation state, media history or catalog.
 */
export function exactSocialMedia(
  pending: SocialMediaSnapshot,
): ExactSocialMedia {
  const mediaType = pending.midiaTipo === "carrossel"
    ? "carrossel"
    : pending.midiaTipo === "video"
    ? "video"
    : "foto";
  const flow = String(pending.produto?.source || "social_post");
  if (mediaType === "carrossel") {
    const urls = cleanUrls(pending.produto?.image_urls);
    return urls.length >= 2 ? { ok: true, urls, mediaType, flow } : {
      ok: false,
      urls: [],
      mediaType,
      flow,
      error: "carrossel_incompleto",
    };
  }
  const url = typeof pending.produto?.imagem_url === "string"
    ? pending.produto.imagem_url.trim()
    : "";
  return url ? { ok: true, urls: [url], mediaType, flow } : {
    ok: false,
    urls: [],
    mediaType,
    flow,
    error: "midia_exata_ausente",
  };
}

export function hasDuplicatedPrompt(
  text: string,
  interactiveBody: string,
): boolean {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  const prompt = normalize(interactiveBody);
  return !!prompt && normalize(text).includes(prompt);
}
