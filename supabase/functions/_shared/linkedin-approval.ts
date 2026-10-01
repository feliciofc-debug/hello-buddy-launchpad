const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu;
const URL_RE = /https?:\/\/[^\s]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_-]+/gu;

function normalizePublicationRequest(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function publicationMediaReference(
  requestText?: string,
): "video" | "image" | "any" | null {
  const request = normalizePublicationRequest(requestText);
  if (/\b(video|reels?)\b/.test(request)) return "video";
  if (/\b(foto|imagem|arte|midia)\b/.test(request)) return "image";
  if (
    /\b(?:isso|esse|essa|este|esta)\b(?!\s+(?:produto|item|servico|oferta)\b)/
      .test(request) ||
    /\b(?:ultima|ultimo)\b/.test(request)
  ) {
    return "any";
  }
  return null;
}

export function isExplicitTextOnlyPublication(requestText?: string): boolean {
  const request = normalizePublicationRequest(requestText);
  return /\b(?:somente|apenas|so)\s+(?:com\s+)?texto\b/.test(request) ||
    /\b(?:posta|poste|postar|publica|publique|publicar)\s+(?:um\s+)?texto\b/
      .test(request);
}

export function shouldPrepareLinkedInTextOnly(input: {
  requestText?: string;
  mediaId?: string;
  imageUrl?: string;
}): boolean {
  if (String(input.mediaId || "").trim() || String(input.imageUrl || "").trim()) {
    return false;
  }
  return isExplicitTextOnlyPublication(input.requestText) &&
    publicationMediaReference(input.requestText) === null;
}

export function sanitizeLinkedInApprovalCopy(value: string): string {
  const input = String(value || "").replace(EMOJI_RE, "");
  const links = input.match(URL_RE) ?? [];
  const hashtags = [...new Set(input.match(HASHTAG_RE) ?? [])].slice(0, 3);
  const body = input
    .replace(URL_RE, "")
    .replace(HASHTAG_RE, "")
    .replace(/\b(?:link nos comentários|link no primeiro comentário)\b[.!]?/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [
    body,
    links[0] || "",
    hashtags.join(" "),
  ].filter(Boolean).join("\n\n");
}

export function isConfirmedLinkedInPublishResult(
  responseOk: boolean,
  payload: { success?: unknown; post_urn?: unknown } | null | undefined,
): boolean {
  return responseOk
    && payload?.success === true
    && /^urn:li:/i.test(String(payload?.post_urn || ""));
}
