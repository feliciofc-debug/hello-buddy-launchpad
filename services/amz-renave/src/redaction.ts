const SENSITIVE_KEY = /(pfx|senha|passphrase|private.?key|token|cpf|cnpj|renavam|chassi|crv|codigo.?seguranca)/i;
const PLATE = /\b([A-Z]{3})[0-9][A-Z0-9][0-9]{2}\b/gi;
const DOCUMENT_NUMBER = /\b\d{11,14}\b/g;

function redactString(value: string): string {
  return value
    .replace(PLATE, (_plate, prefix: string) => `${prefix.toUpperCase()}****`)
    .replace(DOCUMENT_NUMBER, "[REDACTED]");
}

export function redactForLog(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactForLog);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactForLog(item),
    ]),
  );
}

export function logRenaveRequest(input: {
  requestId: string;
  operacao: string;
  ambiente: string;
  status: number;
  duracaoMs: number;
  lojaId?: string;
}): void {
  console.info("[renave]", redactForLog(input));
}
