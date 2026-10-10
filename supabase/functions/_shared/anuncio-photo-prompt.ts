import type { ContentNiche } from "./content-niche.ts";

export type ProductPhotoVariant = "clara" | "escura";
export type ProductPhotoVariants = Record<
  ProductPhotoVariant,
  {
    url: string;
    source: "improved" | "original" | "failed";
    failureReason?: string;
  }
>;

export function shouldUseLogoEditMode(
  mode: unknown,
  prompt: unknown,
): boolean {
  const normalizedMode = String(mode || "").trim().toLowerCase();
  if (["aplicar_logo", "logo", "marca"].includes(normalizedMode)) return true;
  if (normalizedMode) return false;
  return /\b(logo|logotipo|marca|logomarca)\b/i.test(String(prompt || ""));
}

export function productAdPhotoImprovementPrompt(
  title: string,
  niche: ContentNiche = "veiculo",
  variant: ProductPhotoVariant = "escura",
  visualDescription = "",
): string {
  if (niche === "veiculo") {
    return `Prepare esta foto de ${title} para um anúncio comercial premium: recorte/valorize o produto principal, ambiente elegante de showroom com piso reflexivo, iluminação de estúdio, fundo escuro sofisticado e levemente desfocado. Mude SOMENTE o fundo/ambiente e a iluminação. O veículo/produto deve permanecer exatamente como na foto original: mesma pintura e o mesmo brilho real (não deixe a pintura nova nem mais brilhante), mesmos arranhões, amassados, manchas, desgastes e sujeira, mesmas rodas, pneus, adesivos, faixas, acessórios, vidros e placa. Não remova, não corrija, não adicione e não troque nada no veículo. Não altere proporções nem ângulo. É a MESMA unidade da foto original — não troque por outro modelo.`;
  }
  const context = normalize(`${title} ${visualDescription}`);
  const category = /\b(caneca|xicara|copo)\b/.test(context)
    ? "café"
    : /\b(interruptor|tomada|smart home|casa inteligente)\b/.test(context)
    ? "casa inteligente"
    : /\b(fralda|bebe|infantil)\b/.test(context)
    ? "bebê"
    : /\b(ferramenta|furadeira|parafusadeira|martelo)\b/.test(context)
    ? "oficina"
    : /\b(cosmetico|perfume|creme|maquiagem|shampoo)\b/.test(context)
    ? "banheiro ou penteadeira"
    : "uso real do produto";
  const categoryScene = category === "café"
    ? "uma mesa de café montada, com alguns grãos, bule e guardanapo sem marca"
    : category === "casa inteligente"
    ? "uma parede de sala moderna, com decoração residencial discreta"
    : category === "bebê"
    ? "um quarto de bebê suave, com acessórios neutros sem marca"
    : category === "oficina"
    ? "uma bancada de oficina organizada, com ferramentas secundárias sem marca"
    : category === "banheiro ou penteadeira"
    ? "um banheiro ou penteadeira elegante, com acessórios neutros sem marca"
    : "um cenário elegante e coerente com o uso real identificado na imagem, com acessórios de apoio sem marca";
  const scene = category === "café"
    ? variant === "clara"
      ? `Monte ${categoryScene}, clara e arejada: bancada de mármore branco ou bege, luz natural suave da manhã`
      : `Monte ${categoryScene}, escura e sofisticada: bancada de mármore cinza-escuro ou preto, luz quente de destaque e vapor suave`
    : variant === "clara"
    ? `Monte ${categoryScene}, em versão clara, arejada e iluminada por luz natural suave`
    : `Monte ${categoryScene}, em versão escura e sofisticada, com luz de destaque no produto`;
  return `Prepare esta foto de ${title} para um anúncio comercial premium. Pela imagem, confirme a categoria e o uso do produto; o contexto provável é ${category}. ${scene}. O produto é SEMPRE o protagonista: em foco, maior e mais iluminado; os acessórios são secundários e desfocados. Substitua COMPLETAMENTE a superfície e o fundo da foto original; nunca mantenha mesa, bancada, parede ou tecido originais. Mostre o produto INTEIRO, centralizado, com espaço ao redor e margem visual de 8-12%; não corte nenhuma parte, incluindo alça, borda ou embalagem. Preserve ESTE produto exatamente como está (mesma embalagem, textos, cores, logotipo original, proporção e ângulo). Não inclua pessoas nem outros produtos de marca. PROIBIDO adicionar logotipo, marca, texto, estampa ou qualquer marcação no cenário ou no produto. A marca da loja aparece somente no layout da arte, nunca no produto. Você PODE limpar somente sujeira, manchas, poeira, marcas de dedo e reflexos ruins. NÃO altere formato, cor, textos, logotipo original ou estampa e NÃO esconda defeitos estruturais como trinca, lasca ou quebra. Não redesenhe nem substitua nenhuma parte do produto.`;
}

const CONTAMINATING_OBJECTS = [
  "maquina",
  "maquinario",
  "equipamento industrial",
  "galpao",
  "fabrica",
  "linha de producao",
  "pessoa",
  "veiculo",
  "carro",
  "moto",
];

const CONTAMINATING_MARKINGS = [
  "logotipo",
  "logo",
  "marca impressa",
  "marca amz",
  "marca da amz",
  "texto",
  "texto impresso",
  "letras",
  "palavra escrita",
  "estampa",
  "rotulo",
];

const ORIGINAL_SURFACES = [
  "mesa de madeira",
  "bancada de madeira",
  "parede de madeira",
  "tecido estampado",
  "toalha estampada",
  "piso de madeira",
];

function normalize(value: unknown): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function generatedProductPhotoIsSafe(input: {
  generatedDescription: unknown;
  originalDescription?: unknown;
  requestedText?: unknown;
}): boolean {
  return generatedProductPhotoContamination(input) === null;
}

export function generatedProductPhotoContamination(input: {
  generatedDescription: unknown;
  originalDescription?: unknown;
  requestedText?: unknown;
}): string | null {
  const generated = normalize(input.generatedDescription);
  if (!generated) return "descrição vazia";
  const original = normalize(input.originalDescription);
  const allowedObjects = normalize(
    `${input.originalDescription || ""} ${input.requestedText || ""}`,
  );
  const marking = CONTAMINATING_MARKINGS.find((term) =>
    generated.includes(term) && !original.includes(term)
  );
  if (marking) return marking;
  const originalSurface = ORIGINAL_SURFACES.find((term) =>
    original.includes(term) && generated.includes(term)
  );
  if (originalSurface) return `superfície original: ${originalSurface}`;
  return CONTAMINATING_OBJECTS.find((term) =>
      generated.includes(term) && !allowedObjects.includes(term)
    ) || null;
}

export async function generateSafeProductPhotoWithRetry(input: {
  originalDescription?: unknown;
  requestedText?: unknown;
  generate: (
    attempt: number,
  ) => Promise<{ url: string; description: unknown }>;
  maxAttempts?: number;
  onFailure?: (attempt: number, reason: string) => void;
}): Promise<{
  photo: { url: string; source: "improved" } | null;
  attempts: number;
  failureReason?: string;
}> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? 2);
  let failureReason = "falha desconhecida";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const generated = await input.generate(attempt);
      const contamination = generatedProductPhotoContamination({
        generatedDescription: generated.description,
        originalDescription: input.originalDescription,
        requestedText: input.requestedText,
      });
      if (contamination) {
        failureReason = `contaminação: ${contamination}`;
        input.onFailure?.(attempt, failureReason);
        continue;
      }
      const url = String(generated.url || "").trim();
      if (!url) {
        failureReason = "imagem não retornada";
        input.onFailure?.(attempt, failureReason);
        continue;
      }
      return {
        photo: { url, source: "improved" },
        attempts: attempt,
      };
    } catch (error) {
      failureReason = String((error as Error).message || error);
      input.onFailure?.(attempt, failureReason);
    }
  }
  return {
    photo: null,
    attempts: maxAttempts,
    failureReason,
  };
}

export function productPhotoVariantForStyle(
  style: "impacto" | "catalogo" | "destaque",
  variants: ProductPhotoVariants,
): ProductPhotoVariants[ProductPhotoVariant] {
  return style === "catalogo" ? variants.clara : variants.escura;
}

export function availableStylesForProductPhoto(
  styles: Array<"impacto" | "catalogo" | "destaque">,
  variants: ProductPhotoVariants,
): Array<"impacto" | "catalogo" | "destaque"> {
  return styles.filter((style) =>
    productPhotoVariantForStyle(style, variants).source !== "failed"
  );
}

export function failedProductPhotoStyleLabels(
  variants: ProductPhotoVariants,
): string[] {
  const labels: string[] = [];
  if (variants.clara.source === "failed") labels.push("Catálogo");
  if (variants.escura.source === "failed") {
    labels.push("Impacto", "Destaque");
  }
  return labels;
}

export function resolveGeneratedProductPhoto(input: {
  originalUrl: string;
  generatedUrl?: unknown;
  safe: boolean;
}): { url: string; source: "improved" | "original" } {
  const generatedUrl = String(input.generatedUrl || "").trim();
  return generatedUrl && input.safe
    ? { url: generatedUrl, source: "improved" }
    : { url: input.originalUrl, source: "original" };
}
