export const INTERNAL_WHATSAPP_SPLIT = "<<SPLIT>>";

export function stripInternalWhatsAppSplit(message: unknown): string {
  return String(message || "").replaceAll(INTERNAL_WHATSAPP_SPLIT, "\n\n");
}

export function splitInternalWhatsAppMessage(message: unknown): string[] {
  return String(message || "").split(INTERNAL_WHATSAPP_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
}
