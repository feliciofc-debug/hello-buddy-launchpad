export function truncateCodePoints(value: unknown, maximum: number): string {
  return Array.from(String(value ?? "")).slice(0, Math.max(0, maximum)).join("");
}

export function singleLineInteractiveText(
  value: unknown,
  maximum: number,
): string {
  return truncateCodePoints(
    String(value ?? "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim(),
    maximum,
  );
}

export function maskPhoneForLog(value: unknown): string {
  const text = String(value ?? "");
  const digits = text.replace(/\D/g, "");
  if (!digits) return text;
  const visible = digits.slice(-4);
  return `${"*".repeat(Math.max(4, digits.length - visible.length))}${visible}`;
}

export function safeMetaDiagnosticPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(safeMetaDiagnosticPayload);
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes("token") ||
        normalizedKey === "authorization" ||
        normalizedKey === "apikey"
      ) {
        return [key, "[REDACTED]"];
      }
      if (
        normalizedKey === "to" ||
        normalizedKey === "phone" ||
        normalizedKey === "telefone" ||
        normalizedKey === "wa_id"
      ) {
        return [key, maskPhoneForLog(entry)];
      }
      return [key, safeMetaDiagnosticPayload(entry)];
    }),
  );
}
