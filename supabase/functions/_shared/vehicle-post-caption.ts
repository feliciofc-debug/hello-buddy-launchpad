const HTTP_URL_RE = /https?:\/\/[^\s]+/gi;
const WWW_URL_RE = /\bwww\.[^\s]+/gi;
const DOMAIN_RE = /\b[\w.-]+\.(?:com\.br|com|net|org|io)(?:\/[^\s]*)?\b/gi;

export function stripInventedUrlsFromVehicleCaption(text: string): string {
  return String(text || "")
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
}

export function sanitizeVehiclePostsResult(resultado: Record<string, unknown>): void {
  for (const plat of Object.keys(resultado)) {
    const block = resultado[plat];
    if (!block || typeof block !== "object") continue;
    for (const opc of ["opcaoA", "opcaoB", "opcaoC"]) {
      const value = (block as Record<string, unknown>)[opc];
      if (typeof value === "string") {
        (block as Record<string, string>)[opc] = stripInventedUrlsFromVehicleCaption(value);
      }
    }
  }
}
