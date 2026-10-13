export const ANUNCIO_DATA_TTL_MS = 30 * 60 * 1000;

export function pendingAnuncioDataIsActive(
  createdAt: unknown,
  nowMs = Date.now(),
): boolean {
  const createdMs = Date.parse(String(createdAt || ""));
  return Number.isFinite(createdMs) &&
    nowMs - createdMs >= 0 &&
    nowMs - createdMs <= ANUNCIO_DATA_TTL_MS;
}

export function isPendingAnuncioDataCancellation(text: unknown): boolean {
  return /^(?:cancelar?|cancela|desistir|deixa\s+pra\s+l[aá])[\s.!]*$/i.test(
    String(text || "").trim(),
  );
}

export function anuncioArgsFromOwnerData(
  text: unknown,
): Record<string, unknown> | null {
  const raw = String(text || "").replace(
    /<<INTERACTIVE_ID:[^>]+>>/gi,
    "",
  ).trim();
  if (!raw) return null;
  const parts = raw.split(/\s*\/\s*|\n+/).map((part) => part.trim()).filter(
    Boolean,
  );
  if (!parts.length) return null;

  const priceIndex = parts.findIndex((part) =>
    /(?:r\$\s*)?\d[\d.]*,\d{2}\b/i.test(part)
  );
  const conditionIndexes = new Set(
    parts.map((part, index) =>
      /\b(?:pix|cart[aã]o|boleto|à\s+vista|a\s+vista|\d+\s*x|juros|entrada|parcela)\b/i
        .test(part)
        ? index
        : -1
    ).filter((index) => index > 0 && index !== priceIndex),
  );
  const itemParts = parts.filter((_, index) =>
    index > 0 && index !== priceIndex && !conditionIndexes.has(index)
  );
  const conditions = parts.filter((_, index) => conditionIndexes.has(index));

  return {
    titulo: parts[0].slice(0, 120),
    ...(priceIndex >= 0 ? { preco: parts[priceIndex] } : {}),
    ...(itemParts.length ? { itens: itemParts } : {}),
    ...(conditions.length ? { condicoes: conditions } : {}),
  };
}
