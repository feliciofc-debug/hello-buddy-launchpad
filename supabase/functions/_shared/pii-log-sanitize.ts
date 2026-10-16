import { digitsOnly } from "./brazil-person-doc.ts";

const CPF_RAW_RE = /\b\d{11}\b/g;
const CPF_FORMATTED_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactPiiForLog(text: string): string {
  let out = String(text || "");
  out = out.replace(CPF_FORMATTED_RE, "[CPF]");
  out = out.replace(CPF_RAW_RE, (m) =>
    digitsOnly(m).length === 11 ? "[CPF]" : m
  );
  out = out.replace(EMAIL_RE, "[email]");
  out = out.replace(/\b\d{5}-?\d{3}\b/g, "[CEP]");
  return out;
}

export function containsUnredactedCpf(text: string): boolean {
  if (CPF_FORMATTED_RE.test(text)) return true;
  for (const m of String(text || "").match(/\b\d{11}\b/g) ?? []) {
    if (digitsOnly(m).length === 11) return true;
  }
  return false;
}

/** Use antes de console.* — falha se o texto ainda expõe CPF. */
export function assertLogSafe(text: string): void {
  if (containsUnredactedCpf(text)) {
    throw new Error("PII leak: CPF in log");
  }
}

/** Falha o teste se ainda houver CPF legível após redação. */
export function assertLogRedactionHasNoCpf(text: string): void {
  assertLogSafe(redactPiiForLog(text));
}

export function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return redactPiiForLog(msg);
}
