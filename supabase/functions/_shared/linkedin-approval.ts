const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu;
const URL_RE = /https?:\/\/[^\s]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_-]+/gu;

export function shouldPrepareLinkedInTextOnly(input: {
  requestText?: string;
  mediaId?: string;
  imageUrl?: string;
}): boolean {
  if (String(input.mediaId || "").trim() || String(input.imageUrl || "").trim()) {
    return false;
  }
  const request = String(input.requestText || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const mentionsMedia =
    /\b(?:foto|imagem|video|midia|arte|essa|esse|esta|este|ultima|ultimo)\b/.test(request);
  return !mentionsMedia;
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
