export type WhatsAppInteractivePayload = {
  interactive?: {
    button_reply?: { id?: unknown };
    list_reply?: { id?: unknown };
  };
  button?: { payload?: unknown };
};

/**
 * O ID é dado de controle do WhatsApp, não texto escrito pelo usuário.
 * Extraia-o do payload uma única vez e não deixe UUIDs/IDs chegarem a
 * classificadores de intenção livre.
 */
export function extractWhatsAppInteractiveId(
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as WhatsAppInteractivePayload;
  const raw = value.interactive?.button_reply?.id ??
    value.interactive?.list_reply?.id ??
    value.button?.payload;
  const id = String(raw ?? "").trim();
  return id || null;
}

export function stripWhatsAppInteractiveMarkers(text: unknown): string {
  return String(text ?? "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isGestaoInteractiveId(id: unknown): boolean {
  return /^(?:gestao_|molicar_wa:)/i.test(String(id ?? "").trim());
}
