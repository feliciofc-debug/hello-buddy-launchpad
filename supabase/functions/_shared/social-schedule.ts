function saoPauloYear(date: Date): number {
  return Number(new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date));
}

export function parseSaoPauloDateTime(value: unknown, referenceDate = new Date()): Date | null {
  const raw = String(value || "").trim();
  const absolute = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  const brazilian = raw.match(
    /^(\d{2})\/(\d{2})(?:\s*(?:às?|a)?\s*)(\d{1,2})(?::(\d{2})|h(?:(\d{2}))?)$/i,
  );
  if (!absolute && !brazilian) return null;

  let year: string;
  let month: string;
  let day: string;
  let hour: string;
  let minute: string;
  const hasExplicitYear = !!absolute;
  if (absolute) {
    [, year, month, day, hour, minute] = absolute;
  } else {
    day = brazilian![1];
    month = brazilian![2];
    year = String(saoPauloYear(referenceDate));
    hour = brazilian![3];
    minute = brazilian![4] ?? brazilian![5] ?? "00";
  }
  hour = hour.padStart(2, "0");
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
  if (
    parts.year !== year || parts.month !== month || parts.day !== day
    || parts.hour !== hour || parts.minute !== minute
  ) return null;

  if (!hasExplicitYear && date.getTime() <= referenceDate.getTime()) {
    return parseSaoPauloDateTime(
      `${Number(year) + 1}-${month}-${day} ${hour}:${minute}`,
      referenceDate,
    );
  }
  return date;
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
