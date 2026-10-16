const HTTP_URL_RE = /https?:\/\/[^\s]+/gi;
const WWW_URL_RE = /\bwww\.[^\s]+/gi;
const DOMAIN_RE = /\b[\w.-]+\.(?:com\.br|com|net|org|io)(?:\/[^\s]*)?\b/gi;

/** Remove URLs/domínios inventados pela IA no ramo veículo (link real só via toggle). */
export function stripInventedUrlsFromVehicleCaption(text: string): string {
  const cleaned = String(text || "")
    .split("\n")
    .map((line) =>
      line
        .replace(HTTP_URL_RE, "")
        .replace(WWW_URL_RE, "")
        .replace(DOMAIN_RE, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
  return cleaned;
}

export function sanitizeVehiclePostOptions<T extends Record<string, string>>(
  options: T,
): T {
  const out = { ...options };
  for (const key of Object.keys(out)) {
    out[key as keyof T] = stripInventedUrlsFromVehicleCaption(
      out[key as keyof T],
    ) as T[keyof T];
  }
  return out;
}
