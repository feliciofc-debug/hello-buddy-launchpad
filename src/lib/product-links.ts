interface ProductLinkCandidate {
  url?: string | null;
  originalUrl?: string | null;
}

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function getSanitizedProductLinks(product?: ProductLinkCandidate | null) {
  const affiliateLink = normalizeUrl(product?.url);
  const originalLink = normalizeUrl(product?.originalUrl);

  return {
    affiliateLink,
    originalLink,
    safeLink: affiliateLink ?? originalLink,
  };
}

export function getSafeProductLink(product?: ProductLinkCandidate | null) {
  return getSanitizedProductLinks(product).safeLink;
}