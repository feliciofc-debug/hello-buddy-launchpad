const FORBIDDEN_PATTERNS = [
  /\bfipe\b/i,
  /\bkbb\b/i,
  /\bcusto\b/i,
  /\bavaria/i,
  /\banotaç/i,
  /\banotac/i,
  /\binterno\b/i,
  /\bcliente\b/i,
  /\bcpf\b/i,
  /\bcnpj\b/i,
  /\btelefone\b/i,
  /\bwhatsapp\b/i,
];

/** Texto público do anúncio — somente `descricao` do veículo, saneada. */
export function webmotorsPublicObservacao(descricao: string | null | undefined): string {
  const base = (descricao ?? "").trim();
  if (!base) return "";
  let out = base;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(out)) {
      throw new Error(
        "A descrição contém termos que não podem ir para o anúncio. Use apenas texto público do veículo.",
      );
    }
  }
  return out.slice(0, 4000);
}

export function normalizeCatalogLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
