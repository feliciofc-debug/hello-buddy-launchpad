export const META_WHATSAPP_TEXT_LIMIT = 4096;
export const SAFE_WHATSAPP_TEXT_LIMIT = 4000;

function safeBoundary(text: string, boundary: number): number {
  if (boundary <= 0 || boundary >= text.length) return boundary;
  const previous = text.charCodeAt(boundary - 1);
  const current = text.charCodeAt(boundary);
  const splitsSurrogatePair =
    previous >= 0xd800 && previous <= 0xdbff &&
    current >= 0xdc00 && current <= 0xdfff;
  return splitsSurrogatePair ? boundary - 1 : boundary;
}

function splitLongBlock(block: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = block.trim();

  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength + 1);
    const candidates = [
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf(" "),
    ];
    let boundary = Math.max(...candidates);
    if (boundary < Math.floor(maxLength * 0.5)) boundary = maxLength;
    else if (/[.!?]/.test(window[boundary] || "")) boundary += 1;
    boundary = safeBoundary(remaining, boundary);

    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Salvaguarda de transporte para mensagens livres da Cloud API.
 * Prioriza parágrafos; só quebra frases/palavras quando um parágrafo isolado
 * já ultrapassa o limite. 4.000 deixa margem abaixo do teto da Meta (4.096).
 */
export function splitWhatsAppText(
  text: string,
  maxLength = SAFE_WHATSAPP_TEXT_LIMIT,
): string[] {
  if (maxLength <= 0 || maxLength > META_WHATSAPP_TEXT_LIMIT) {
    throw new Error(`limite de texto inválido: ${maxLength}`);
  }

  const normalized = String(text ?? "").trim();
  if (normalized.length <= maxLength) return [normalized];

  const blocks = normalized
    .split(/\n{2,}/)
    .flatMap((block) => splitLongBlock(block, maxLength))
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = block;
  }
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [normalized.slice(0, maxLength)];
}
