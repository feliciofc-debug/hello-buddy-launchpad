export function cleanReceivedMediaDescription(value: unknown): string {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const vision = raw.match(/\[(?:visão|visao)\]\s*(.+)$/i)?.[1] || raw;
  return vision
    .replace(/\[(?:visão|visao|imagem|foto|id)[^\]]*\]/gi, " ")
    .replace(/\b(?:ID|código)\s+[0-9a-f-]{8,}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recognizedMediaReply(input: {
  type: "foto" | "video" | "audio";
  description?: string | null;
}): string {
  const label = input.type === "video"
    ? "este vídeo"
    : input.type === "audio"
    ? "este áudio"
    : "esta imagem";
  const description = cleanReceivedMediaDescription(input.description);
  return description
    ? `Peguei ${label} novamente: ${description} Esta mídia fica como a mais recente.`
    : `Peguei ${label} novamente. Esta mídia fica como a mais recente.`;
}

export function createRecentAutomaticMessageGuard(ttlMs = 30_000) {
  const entries = new Map<string, { at: number; receipt?: string | null }>();
  return {
    claim(key: string, nowMs = Date.now()) {
      for (const [storedKey, entry] of entries) {
        if (nowMs - entry.at >= ttlMs) entries.delete(storedKey);
      }
      const recent = entries.get(key);
      if (recent && nowMs - recent.at < ttlMs) {
        return {
          allowed: false as const,
          receipt: recent.receipt ?? null,
        };
      }
      entries.set(key, { at: nowMs });
      return { allowed: true as const, receipt: null };
    },
    complete(key: string, receipt: string | null) {
      const entry = entries.get(key);
      if (entry) entry.receipt = receipt;
    },
    release(key: string) {
      entries.delete(key);
    },
  };
}
