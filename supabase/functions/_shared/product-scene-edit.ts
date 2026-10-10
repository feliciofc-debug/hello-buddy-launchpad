// Confirmado no catálogo público /v1/models do gateway em 2026-10-10:
// saída de imagem premium disponível, com Flash Image como fallback.
export const PRODUCT_SCENE_PRO_MODEL = "google/gemini-3-pro-image";
export const PRODUCT_SCENE_FLASH_MODEL = "google/gemini-3.1-flash-image";
export const PRODUCT_SCENE_IMAGE_MODELS = [
  PRODUCT_SCENE_PRO_MODEL,
  PRODUCT_SCENE_FLASH_MODEL,
] as const;

const IMAGE_TOKENS_1K = 1120;

export function estimatedProductSceneCostUsd(
  model: string,
  inputImages = 1,
  resolution: "1K" | "2K" = "1K",
): number {
  const isPro = model === PRODUCT_SCENE_PRO_MODEL;
  const inputTokenCost = isPro ? 0.000002 : 0.0000005;
  const outputImageTokenCost = isPro ? 0.00012 : 0.00006;
  const outputTokens = resolution === "2K" ? 1680 : IMAGE_TOKENS_1K;
  return Number(
    (
      IMAGE_TOKENS_1K * inputImages * inputTokenCost +
      outputTokens * outputImageTokenCost
    ).toFixed(5),
  );
}

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sceneAdjustmentRequiresRegeneration(value: string): boolean {
  const text = normalize(value);
  return /\b(troca|troque|muda|mude|substitui|substitua|adiciona|adicione|remove|remova|tira|retira|maior|menor|aumenta|aumente|diminui|diminua|tamanho|escala|proporcao|reposiciona|reposicione|posicao|composicao|enquadramento)\b.{0,45}\b(objeto|produto|caneca|xicara|cafeteira|maquina|mesa|bancada|cenario|ambiente|fundo|posicao|tamanho|escala|composicao)\b/
    .test(text) ||
    /\b(objeto|produto|caneca|xicara|cafeteira|maquina|mesa|bancada|cenario|ambiente|fundo)\b.{0,45}\b(troca|troque|muda|mude|substitui|substitua|maior|menor|tamanho|escala|proporcao|posicao|composicao)\b/
      .test(text);
}

export function combineSceneInstructions(
  previousRequest: string,
  adjustment: string,
): string {
  const previous = String(previousRequest || "").trim();
  const next = String(adjustment || "").trim();
  if (!previous) return next;
  if (!next) return previous;
  return `${previous}\n\nAJUSTE ADICIONAL OBRIGATÓRIO:\n${next}`;
}

export function planProductSceneAdjustment(input: {
  adjustment: string;
  previousRequest?: string | null;
  currentMediaId: string;
  currentUrl: string;
  originalMediaId?: string | null;
  originalUrl?: string | null;
}): {
  regenerate: boolean;
  sourceMediaId: string;
  sourceUrl: string;
  instruction: string;
} {
  const wantsRegeneration = sceneAdjustmentRequiresRegeneration(
    input.adjustment,
  );
  const canUseOriginal = wantsRegeneration &&
    !!input.originalMediaId &&
    !!input.originalUrl;
  return {
    regenerate: canUseOriginal,
    sourceMediaId: canUseOriginal
      ? input.originalMediaId!
      : input.currentMediaId,
    sourceUrl: canUseOriginal ? input.originalUrl! : input.currentUrl,
    instruction: canUseOriginal
      ? combineSceneInstructions(
        String(input.previousRequest || ""),
        input.adjustment,
      )
      : input.adjustment,
  };
}

export function productSceneScaleDirective(): string {
  return `ESCALA E FÍSICA DA CENA:
- Use proporções reais entre todos os objetos. O tamanho do produto na foto de referência NÃO determina seu tamanho na cena.
- Você PODE redimensionar e reposicionar o produto para respeitar a escala real, mantendo aparência, formato, cor, textura, material, detalhes e logo.
- Exemplo físico: uma xícara tem cerca de 10 cm; uma máquina de expresso profissional tem cerca de 40–50 cm. A xícara deve ficar apoiada na grade, sob o bico, com perspectiva, contato, sombras e reflexos coerentes.
- O resultado deve ser uma fotografia realista de produto, com proporções reais, sem aparência artificial.`;
}
