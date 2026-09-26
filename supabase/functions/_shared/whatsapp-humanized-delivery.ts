import { splitWhatsAppText } from "./whatsapp-text.ts";

export const LEAD_MAX_PARTS = 3;
export const LEAD_CODE_SPLIT_LIMIT = 700;

export function virtualAssistantDisclosure(businessName: string): string {
  const company = businessName.trim() || "empresa";
  return `Sou o assistente virtual da ${company}. Se preferir, posso chamar alguém da equipe.`;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function firstReplyTargetMs(characterCount: number): number {
  return clamp(2500 + Math.max(0, characterCount) * 35, 3000, 12000);
}

export function betweenReplyPartsMs(characterCount: number): number {
  return clamp(1500 + Math.max(0, characterCount) * 30, 2000, 6000);
}

export function remainingFirstReplyDelayMs(
  receivedAt: string | Date | null | undefined,
  characterCount: number,
  now = new Date(),
): number {
  const receivedMs = receivedAt ? new Date(receivedAt).getTime() : now.getTime();
  const elapsed = Number.isFinite(receivedMs) ? Math.max(0, now.getTime() - receivedMs) : 0;
  return Math.max(0, firstReplyTargetMs(characterCount) - elapsed);
}

export function firstReplyDelayForSenderMs(
  isOwner: boolean,
  receivedAt: string | Date | null | undefined,
  characterCount: number,
  now = new Date(),
): number {
  return isOwner ? 0 : remainingFirstReplyDelayMs(receivedAt, characterCount, now);
}

export function betweenPartsDelayForSenderMs(
  isOwner: boolean,
  characterCount: number,
): number {
  return isOwner ? 0 : betweenReplyPartsMs(characterCount);
}

function shortenFinalPart(part: string): string {
  const suffix = " Se quiser, continuo na próxima mensagem.";
  const available = LEAD_CODE_SPLIT_LIMIT - suffix.length;
  const shortened = splitLeadTextAtSentences(part, available)[0]?.trim() || "";
  return `${shortened}${suffix}`.trim();
}

function splitLeadTextAtSentences(text: string, maxLength: number): string[] {
  const transportSafe = splitWhatsAppText(text, 4000);
  const result: string[] = [];
  for (const transportPart of transportSafe) {
    let remaining = transportPart.trim();
    while (remaining.length > maxLength) {
      const window = remaining.slice(0, maxLength + 1);
      const sentenceEnds = [...window.matchAll(/[.!?](?=\s|$)/g)];
      let boundary = sentenceEnds.at(-1)?.index;
      if (boundary != null) boundary += 1;
      if (!boundary || boundary < Math.floor(maxLength * 0.25)) {
        boundary = window.lastIndexOf(" ");
      }
      if (boundary < 1) boundary = maxLength;
      result.push(remaining.slice(0, boundary).trim());
      remaining = remaining.slice(boundary).trimStart();
    }
    if (remaining) result.push(remaining);
  }
  return result;
}

export function prepareLeadReplyParts(reply: string): string[] {
  const parts = String(reply || "")
    .split("<<SPLIT>>")
    .flatMap((part) => splitLeadTextAtSentences(part.trim(), LEAD_CODE_SPLIT_LIMIT))
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= LEAD_MAX_PARTS) return parts;
  return [
    ...parts.slice(0, LEAD_MAX_PARTS - 1),
    shortenFinalPart(parts[LEAD_MAX_PARTS - 1]),
  ];
}

export function hasNewerProcessableInbound(
  currentCreatedAt: string,
  candidates: Array<{ created_at: string; status: string }>,
): boolean {
  const currentMs = new Date(currentCreatedAt).getTime();
  const processable = new Set(["received", "processing", "done", "grouped"]);
  return candidates.some((candidate) =>
    processable.has(candidate.status)
    && new Date(candidate.created_at).getTime() > currentMs
  );
}
