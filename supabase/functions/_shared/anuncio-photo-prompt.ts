import type { ContentNiche } from "./content-niche.ts";

export type ProductPhotoVariant = "clara" | "escura";
export type ProductPhotoVariants = Record<
  ProductPhotoVariant,
  { url: string; source: "improved" | "original" }
>;

export function productAdPhotoImprovementPrompt(
  title: string,
  niche: ContentNiche = "veiculo",
  variant: ProductPhotoVariant = "escura",
): string {
  if (niche === "veiculo") {
    return `Prepare esta foto de ${title} para um anúncio comercial premium: recorte/valorize o produto principal, ambiente elegante de showroom com piso reflexivo, iluminação de estúdio, fundo escuro sofisticado e levemente desfocado. Mude SOMENTE o fundo/ambiente e a iluminação. O veículo/produto deve permanecer exatamente como na foto original: mesma pintura e o mesmo brilho real (não deixe a pintura nova nem mais brilhante), mesmos arranhões, amassados, manchas, desgastes e sujeira, mesmas rodas, pneus, adesivos, faixas, acessórios, vidros e placa. Não remova, não corrija, não adicione e não troque nada no veículo. Não altere proporções nem ângulo. É a MESMA unidade da foto original — não troque por outro modelo.`;
  }
  const background = variant === "clara"
    ? "fundo infinito branco ou creme suave, levemente tingido pela cor dominante da embalagem"
    : "fundo infinito grafite, com um brilho de LED sutil atrás do produto";
  return `Prepare esta foto de ${title} para um anúncio comercial premium. Coloque ESTE produto, exatamente como está (mesma embalagem, textos, cores, logotipo, proporção e ângulo), sobre uma superfície limpa e lisa, em um estúdio fotográfico neutro, com ${background}, iluminação suave de LED e sombra de contato discreta. Você PODE limpar somente sujeira, manchas, poeira, marcas de dedo e reflexos ruins. NÃO altere formato, cor, textos, logotipo ou estampa e NÃO esconda defeitos estruturais como trinca, lasca ou quebra. PROIBIDO adicionar qualquer objeto, máquina, móvel, pessoa, planta ou cenário. Só fundo, luz e sombra. Não redesenhe nem substitua nenhuma parte do produto.`;
}

const CONTAMINATING_OBJECTS = [
  "maquina",
  "maquinario",
  "equipamento industrial",
  "galpao",
  "fabrica",
  "linha de producao",
  "movel",
  "cadeira",
  "mesa",
  "pessoa",
  "planta",
  "veiculo",
  "carro",
  "moto",
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
  const generated = normalize(input.generatedDescription);
  if (!generated) return false;
  const allowedContext = normalize(
    `${input.originalDescription || ""} ${input.requestedText || ""}`,
  );
  return !CONTAMINATING_OBJECTS.some((term) =>
    generated.includes(term) && !allowedContext.includes(term)
  );
}

export function productPhotoVariantForStyle(
  style: "impacto" | "catalogo" | "destaque",
  variants: ProductPhotoVariants,
): { url: string; source: "improved" | "original" } {
  return style === "catalogo" ? variants.clara : variants.escura;
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
