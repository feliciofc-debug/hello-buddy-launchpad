export function parseSaoPauloDateTime(value: unknown): Date | null {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return parts.year === year && parts.month === month && parts.day === day
      && parts.hour === hour && parts.minute === minute
    ? date
    : null;
}

export function formatScheduledDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(date);
  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${weekday}, ${dayMonth}, às ${time}`;
}

export function formatSocialNetworks(networks: string[]): string {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
  };
  const values = [...new Set(networks)].map((network) => labels[network] || network);
  if (values.length <= 1) return values[0] || "redes selecionadas";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

export function normalizeImageUrls(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .filter((item): item is string => typeof item === "string" && !!item.trim())
        .map((item) => item.trim()),
    )];
  }
  if (typeof value === "string") {
    try {
      return normalizeImageUrls(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}
