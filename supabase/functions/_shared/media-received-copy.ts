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
    ? "vídeo"
    : input.type === "audio" ? "áudio" : "imagem";
  const description = cleanReceivedMediaDescription(input.description);
  return description
    ? `Peguei este ${label} novamente: ${description} Vou tratá-lo como a mídia mais recente.`
    : `Peguei este ${label} novamente. Vou tratá-lo como a mídia mais recente.`;
}
