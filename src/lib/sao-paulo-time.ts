const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";
const SAO_PAULO_UTC_OFFSET_HOURS = 3;

function getSaoPauloParts(input: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(input));

  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function getSaoPauloNow() {
  const parts = getSaoPauloParts();
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
}

export function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function isBeforeTodayInSaoPaulo(date: Date) {
  return startOfDay(date) < startOfDay(getSaoPauloNow());
}

export function isSameCalendarDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function getNextFiveMinuteSlot(base = getSaoPauloNow()) {
  const nextSlot = new Date(base);
  nextSlot.setSeconds(0, 0);
  nextSlot.setMinutes(nextSlot.getMinutes() + 5);

  const remainder = nextSlot.getMinutes() % 5;
  if (remainder !== 0) {
    nextSlot.setMinutes(nextSlot.getMinutes() + (5 - remainder));
  }

  return nextSlot;
}

export function toTimeString(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function generateTimeOptions(stepMinutes = 5) {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      options.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
  }

  return options;
}

export function clampTimeForToday(selectedDate: Date, selectedTime: string) {
  const nextSlot = getNextFiveMinuteSlot();
  const minimumTime = toTimeString(nextSlot);

  if (isSameCalendarDay(selectedDate, nextSlot) && selectedTime < minimumTime) {
    return minimumTime;
  }

  return selectedTime;
}

export function combineSaoPauloDateTimeToIso(selectedDate: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return new Date(
    Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours + SAO_PAULO_UTC_OFFSET_HOURS,
      minutes,
      0,
      0,
    ),
  ).toISOString();
}

export function formatSaoPauloDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIMEZONE,
    ...options,
  }).format(new Date(value));
}

export function toSaoPauloDateKey(value: string | Date = new Date()) {
  return new Date(value).toLocaleDateString("sv-SE", { timeZone: SAO_PAULO_TIMEZONE });
}