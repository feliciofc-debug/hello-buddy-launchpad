const AUTO_REPLY_MAX_DELAY_MS = 2 * 60 * 1000;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelyBusinessAutoReply(input: {
  text: unknown;
  invitationSentAt: string | null | undefined;
  receivedAt?: string | null;
  buttonId?: string | null;
}): boolean {
  if (input.buttonId) return false;

  const invitationTime = Date.parse(String(input.invitationSentAt ?? ""));
  const receivedTime = input.receivedAt
    ? Date.parse(input.receivedAt)
    : Date.now();
  const delay = receivedTime - invitationTime;
  if (
    !Number.isFinite(invitationTime) ||
    !Number.isFinite(receivedTime) ||
    delay < 0 ||
    delay > AUTO_REPLY_MAX_DELAY_MS
  ) {
    return false;
  }

  const text = normalizeText(input.text);
  if (!text) return false;

  return [
    /\bseja bem[- ]vind[oa]\b/,
    /\bbem[- ]vind[oa]\b/,
    /\bobrigad[oa] por (?:entrar em )?contato\b/,
    /\bem breve (?:retornaremos|responderemos)\b/,
    /\b(?:nosso|o) horario de atendimento\b/,
    /\bfora do (?:nosso )?(?:horario|expediente)\b/,
    /\bqual (?:doce|produto) voce procura\b/,
    /\b(?:digite|responda|escolha) (?:uma opcao|[0-9])\b/,
    /\b1[.)-]?\s+\S.+\b2[.)-]?\s+\S/,
  ].some((pattern) => pattern.test(text));
}
