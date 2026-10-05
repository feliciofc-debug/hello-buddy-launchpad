export type AnuncioSourceMedia = {
  id: string;
  tipo?: string | null;
  origem?: string | null;
  midia_url?: string | null;
  telefone_origem?: string | null;
  created_at?: string | null;
};

export function isOriginalReceivedPhoto(
  media: AnuncioSourceMedia | null | undefined,
): boolean {
  return media?.tipo === "foto" &&
    String(media.origem || "").toLowerCase() === "whatsapp" &&
    /^https?:\/\//i.test(String(media.midia_url || ""));
}

export function selectRecentOriginalPhoto(input: {
  candidates: AnuncioSourceMedia[];
  lastInteraction?: { media_id?: string | null; at?: string | null } | null;
  nowMs?: number;
  maxAgeMs?: number;
}): AnuncioSourceMedia | null {
  const nowMs = input.nowMs ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? 30 * 60 * 1000;
  const interactionAt = Date.parse(String(input.lastInteraction?.at || ""));
  const interactionId = String(input.lastInteraction?.media_id || "");
  return input.candidates
    .filter(isOriginalReceivedPhoto)
    .map((media) => {
      const createdAt = Date.parse(String(media.created_at || ""));
      const effectiveAt = media.id === interactionId &&
          Number.isFinite(interactionAt)
        ? Math.max(createdAt || 0, interactionAt)
        : createdAt;
      return { media, effectiveAt };
    })
    .filter(({ effectiveAt }) =>
      Number.isFinite(effectiveAt) &&
      effectiveAt <= nowMs &&
      nowMs - effectiveAt <= maxAgeMs
    )
    .sort((first, second) => second.effectiveAt - first.effectiveAt)[0]
    ?.media ?? null;
}
