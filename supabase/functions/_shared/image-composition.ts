import {
  estimatedProductSceneCostUsd,
  PRODUCT_SCENE_IMAGE_MODELS,
  PRODUCT_SCENE_PRO_MODEL,
} from "./product-scene-edit.ts";

export const IMAGE_COMPOSITION_MODEL = PRODUCT_SCENE_PRO_MODEL;
export const IMAGE_COMPOSITION_MODELS = PRODUCT_SCENE_IMAGE_MODELS;

export type ImageCompositionResolution = "1K" | "2K";

export const IMAGE_COMPOSITION_ESTIMATED_COST_USD: Record<
  ImageCompositionResolution,
  number
> = {
  "1K": estimatedProductSceneCostUsd(IMAGE_COMPOSITION_MODEL, 2, "1K"),
  "2K": estimatedProductSceneCostUsd(IMAGE_COMPOSITION_MODEL, 2, "2K"),
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

export function isProductAdCreativeRequest(value: string): boolean {
  const text = normalizeText(value);
  if (!text) return false;
  const creative = /\b(anuncio|arte|banner|card|peca|criativo)\b/.test(text);
  const product =
    /\b(carro|veiculo|automovel|moto|produto|loja|preco|fipe|quilometragem|km|ano)\b/
      .test(text);
  return creative && product;
}

export function shouldImproveProductAdPhoto(value: string): boolean {
  const text = normalizeText(value);
  return !/\b(?:usa|usar|use|mantem|manter|mantenha)\s+(?:a\s+)?foto\s+como\s+(?:ela\s+)?esta\b/
    .test(text) &&
    !/\bsem\s+(?:melhorar|editar|alterar|mexer\s+n[oa])\s+(?:a\s+)?foto\b/.test(
      text,
    );
}

export function isImageCompositionIntent(value: string): boolean {
  const text = normalizeText(value);
  if (
    !text ||
    isProductAdCreativeRequest(value) ||
    /\b(video|reels?|animad[oa]|animacao)\b/.test(text)
  ) return false;

  const action =
    /\b(coloca|colocar|ponha|poe|por|instala|instalar|simula|simular|insere|inserir|aplica|aplicar|monta|montar)\b/
      .test(text) ||
    /\bcomo (?:fica|ficaria|(?:vai |iria )?ficar)\b/.test(text);
  const placement =
    /\b(no|na|nos|nas|sobre|em cima|dentro|ambiente|sala|quarto|cozinha|mesa|parede|teto|casa|espaco)\b/
      .test(text);
  const demonstrativeProduct =
    /\b(esse|essa|este|esta|produto|lustre|luminaria|pendente|sofa|poltrona|mesa|cadeira|tapete|quadro|movel)\b/
      .test(text);

  return action && placement && demonstrativeProduct;
}

export function isExplicitTwoImageCompositionRequest(value: string): boolean {
  const text = normalizeText(value);
  return /\b(duas|2)\s+(fotos|imagens)\b/.test(text) ||
    /\b(junta|juntar|combine|combina|combinar|mistura|misturar)\b.{0,35}\b(fotos|imagens|essa|essas|as duas)\b/
      .test(text) ||
    /\b(uma|foto|imagem)\b.{0,35}\b(com|na|em)\b.{0,35}\b(outra|segunda)\s+(foto|imagem)\b/
      .test(text);
}

export function requestedCompositionResolution(
  value: string,
): ImageCompositionResolution {
  const text = normalizeText(value);
  return /\b(2k|alta resolucao|em alta|alta qualidade|qualidade alta|alta definicao)\b/
      .test(text)
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
  const first = parsed.find((item) =>
    typeof item === "string" && /^https?:\/\//i.test(item)
  );
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
  const textTokens = new Set(
    text.split(" ").filter((token) => token.length >= 3),
  );
  const scored = products
    .map((product) => {
      const name = normalizeText(product.nome);
      const tokens = name.split(" ").filter((token) => token.length >= 3);
      const exact = name.length >= 4 && text.includes(name) ? 100 : 0;
      const overlap = tokens.reduce(
        (score, token) => score + (textTokens.has(token) ? 1 : 0),
        0,
      );
      return { product, score: exact + overlap, tokenCount: tokens.length };
    })
    .filter(({ product, score }) => score > 0 && !!catalogImageUrl(product))
    .sort((a, b) => b.score - a.score || a.tokenCount - b.tokenCount);

  if (scored.length === 0) return null;
  if (
    scored.length > 1 && scored[0].score === scored[1].score &&
    scored[0].score < 100
  ) {
    return null;
  }
  return scored[0].product;
}

export function environmentLikelihood(value: string): number {
  const text = normalizeText(value);
  const matches = text.match(
    /\b(sala|quarto|cozinha|banheiro|varanda|ambiente|casa|mesa|parede|teto|sofa|janela|porta|piso)\b/g,
  );
  return matches?.length ?? 0;
}
