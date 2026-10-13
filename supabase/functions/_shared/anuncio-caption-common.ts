export function normalizeCaptionText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function captionValues(value: unknown): string[] {
  return (Array.isArray(value) ? value : value == null ? [] : [value])
    .flatMap((item) => String(item).split(","))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function clipCaption(value: string): string {
  const compact = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
  return compact.length <= 600
    ? compact
    : compact.slice(0, 597).replace(/\s+\S*$/, "") + "...";
}

export function normalizeBrazilianWhatsappNumber(value: unknown): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : "";
}

export function captionContactLine(
  data: Record<string, unknown>,
): string {
  const phone = normalizeBrazilianWhatsappNumber(
    data.telefone || data.contato,
  );
  return phone ? `📱 Chame no WhatsApp: https://wa.me/${phone}` : "";
}
