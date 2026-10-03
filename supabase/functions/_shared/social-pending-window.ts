export const RECENT_PENDING_INTERACTION_MS = 30 * 60 * 1000;
export const PENDING_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type ExplicitPendingPostCommand = "schedule" | "publish";

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isPendingInteractionRecent(
  createdAt: string | number | Date | null | undefined,
  updatedAt: string | number | Date | null | undefined,
  now = new Date(),
): boolean {
  const timestamps = [createdAt, updatedAt]
    .map((value) => value == null ? Number.NaN : new Date(value).getTime())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return false;
  const latest = Math.max(...timestamps);
  const age = now.getTime() - latest;
  return age >= 0 && age <= RECENT_PENDING_INTERACTION_MS;
}

export function canUseAmbiguousPendingReply(isRecent: boolean, hasMedia = false): boolean {
  return isRecent && !hasMedia;
}

export function requiresOldPendingPublishConfirmation(isRecent: boolean): boolean {
  return !isRecent;
}

export function classifyExplicitPendingPostCommand(
  text: string,
  hasMedia = false,
): ExplicitPendingPostCommand | null {
  if (hasMedia) return null;
  const normalized = normalize(text.replace(/<<INTERACTIVE_ID:[^>]+>>/gi, ""));
  if (/^(?:publicar agora|postar agora|pode postar|pode publicar)$/.test(normalized)) {
    return "publish";
  }

  const schedule = normalized.match(/^(?:agendar|agenda|agende)(?:\s+(.*))?$/);
  if (!schedule) return null;
  const remainder = schedule[1]?.trim();
  if (!remainder) return "schedule";
  if (/\b(?:facebook|instagram|linkedin|tiktok|rede|foto|video|imagem|carrossel|post novo)\b/.test(remainder)) {
    return null;
  }
  if (/\b(?:lembrete|tarefa|ligacao|reuniao|visita|compromisso|consulta|fornecedor)\b/.test(remainder)) {
    return null;
  }
  return /^(?:para\s+)?(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|hoje\b|amanha\b|depois de amanha\b|(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?\b|dia\s+\d{1,2}\b|as?\s+\d{1,2}(?::\d{2})?h?\b)/.test(remainder)
    ? "schedule"
    : null;
}
