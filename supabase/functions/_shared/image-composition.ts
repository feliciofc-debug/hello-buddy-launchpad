export const IMAGE_COMPOSITION_MODEL = "google/gemini-3.1-flash-image";

export type ImageCompositionResolution = "1K" | "2K";

export const IMAGE_COMPOSITION_ESTIMATED_COST_USD: Record<ImageCompositionResolution, number> = {
  // Duas imagens de entrada: 2 × 1.120 tokens × US$ 0,50/M.
  // Saída: US$ 0,067 (1K) ou US$ 0,101 (2K). Texto é residual.
  "1K": 0.06812,
  "2K": 0.10212,
};

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isImageCompositionIntent(value: string): boolean {
  const text = normalizeText(value);
  if (!text || /\b(video|reels?|animad[oa]|animacao)\b/.test(text)) return false;

  const action =
    /\b(coloca|colocar|ponha|poe|por|instala|instalar|simula|simular|insere|inserir|aplica|aplicar|monta|montar)\b/.test(text) ||
    /\bcomo (?:vai |iria )?ficar\b/.test(text);
  const placement =
    /\b(no|na|nos|nas|sobre|em cima|dentro|ambiente|sala|quarto|cozinha|mesa|parede|teto|casa|espaco)\b/.test(text);
  const demonstrativeProduct =
    /\b(esse|essa|este|esta|produto|lustre|luminaria|pendente|sofa|poltrona|mesa|cadeira|tapete|quadro|movel)\b/.test(text);

  return action && placement && demonstrativeProduct;
}

export function requestedCompositionResolution(value: string): ImageCompositionResolution {
  const text = normalizeText(value);
  return /\b(2k|alta resolucao|em alta|alta qualidade|qualidade alta|alta definicao)\b/.test(text)
    ? "2K"
    : "1K";
}

export type CatalogImageCandidate = {
  id: string;
  nome: string;
  imagem_url?: string | null;
  imagens?: unknown;
};

function firstJsonImage(value: unknown): string | null {
  const parsed = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })()
    : value;
  if (!Array.isArray(parsed)) return null;
  const first = parsed.find((item) => typeof item === "string" && /^https?:\/\//i.test(item));
  return typeof first === "string" ? first : null;
}

export function catalogImageUrl(product: CatalogImageCandidate): string | null {
  return product.imagem_url?.trim() || firstJsonImage(product.imagens);
}

export function selectCatalogProduct(
  value: string,
  products: CatalogImageCandidate[],
): CatalogImageCandidate | null {
  const text = normalizeText(value);
  const textTokens = new Set(text.split(" ").filter((token) => token.length >= 3));
  const scored = products
    .map((product) => {
      const name = normalizeText(product.nome);
      const tokens = name.split(" ").filter((token) => token.length >= 3);
      const exact = name.length >= 4 && text.includes(name) ? 100 : 0;
      const overlap = tokens.reduce((score, token) => score + (textTokens.has(token) ? 1 : 0), 0);
      return { product, score: exact + overlap, tokenCount: tokens.length };
    })
    .filter(({ product, score }) => score > 0 && !!catalogImageUrl(product))
    .sort((a, b) => b.score - a.score || a.tokenCount - b.tokenCount);

  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score && scored[0].score < 100) {
    return null;
  }
  return scored[0].product;
}

export function environmentLikelihood(value: string): number {
  const text = normalizeText(value);
  const matches = text.match(/\b(sala|quarto|cozinha|banheiro|varanda|ambiente|casa|mesa|parede|teto|sofa|janela|porta|piso)\b/g);
  return matches?.length ?? 0;
}
