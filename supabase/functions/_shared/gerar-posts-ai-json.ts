/**
 * Leitura tolerante de JSON devolvido por modelos (gerar-posts e similares).
 * Não logar o texto bruto — pode conter PII do briefing do cliente.
 */

export type ParseAiJsonResult<T = Record<string, unknown>> =
  | { ok: true; value: T }
  | { ok: false; reason: "empty" | "no_object" | "invalid" };

export function stripAiJsonFences(raw: string): string {
  return String(raw || "")
    .replace(/```json\s*/gi, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

/** Extrai o primeiro objeto `{...}` balanceado (ignora colchetes/array soltos). */
export function extractFirstJsonObject(text: string): string | null {
  const cleaned = stripAiJsonFences(text);
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString && c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

export function repairAiJsonString(jsonStr: string): string {
  return jsonStr
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function tryParseObject<T>(jsonStr: string): T | null {
  try {
    const parsed = JSON.parse(jsonStr) as T;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseAiJsonObject<T = Record<string, unknown>>(
  raw: string,
): ParseAiJsonResult<T> {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return { ok: false, reason: "no_object" };

  const direct = tryParseObject<T>(extracted);
  if (direct) return { ok: true, value: direct };

  const repaired = repairAiJsonString(extracted);
  const second = tryParseObject<T>(repaired);
  if (second) return { ok: true, value: second };

  return { ok: false, reason: "invalid" };
}

export const GERAR_POSTS_JSON_RETRY_SUFFIX =
  "\n\nIMPORTANTE: responda SOMENTE JSON válido, sem markdown, sem texto antes ou depois, sem vírgula sobrando.";

export const GERAR_POSTS_FRIENDLY_ERROR =
  "Não consegui gerar o texto agora, tente de novo";
