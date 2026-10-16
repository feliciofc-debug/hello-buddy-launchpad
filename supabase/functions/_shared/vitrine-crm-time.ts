export const SAO_PAULO_TZ = "America/Sao_Paulo";

export function dateKeySaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hourMinuteSaoPaulo(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/** Resumo diário: 19h–23:59 SP, uma vez por dia. */
export function shouldRunDailyResumoWindow(
  now: Date,
  lastRunDaySp: string | null,
): boolean {
  const today = dateKeySaoPaulo(now);
  if (lastRunDaySp === today) return false;
  const { hour } = hourMinuteSaoPaulo(now);
  return hour >= 19 && hour <= 23;
}

/** Retomada: 08h–21h SP (inclusive). */
export function isRetomadaAllowedHour(now = new Date()): boolean {
  const { hour } = hourMinuteSaoPaulo(now);
  return hour >= 8 && hour <= 21;
}

/** Próximo slot 08:00 SP no mesmo dia ou dia seguinte. */
export function nextRetomadaAllowedTime(from = new Date()): Date {
  const { hour } = hourMinuteSaoPaulo(from);
  if (hour >= 8 && hour <= 21) return from;
  const target = new Date(from.getTime());
  if (hour > 21) target.setUTCDate(target.getUTCDate() + 1);
  const dayKey = dateKeySaoPaulo(target);
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 8 + 3, 0, 0));
}
