import { cleanReceivedMediaDescription } from "./media-received-copy.ts";

export type OwnerPhotoConfirmRoute = "produto" | "veiculo" | "incerto";

export function normalizeOwnerPhotoDescription(value: unknown): string {
  return cleanReceivedMediaDescription(value).replace(/\s+/g, " ").trim();
}

export function ownerPhotoItemSummary(description: string): string {
  const cleaned = normalizeOwnerPhotoDescription(description)
    .replace(
      /^(?:esta\s+[eé]\s+|trata-se\s+de\s+)?(?:uma?\s+)?foto\s+real\s+de\s+produto\s*(?:apresentando|que\s+mostra|mostrando)?\s*/i,
      "",
    )
    .replace(
      /^(?:esta\s+[eé]\s+)?(?:uma?\s+)?(?:foto|imagem)\s+(?:que\s+)?(?:mostra|apresenta|exibe)\s*/i,
      "",
    )
    .replace(/^(?:um|uma|o|a)\s+/i, "")
    .split(
      /[.;]|\s+(?:sobre|posicionad[oa]|em frente|ao fundo|com fundo)\b/i,
    )[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.split(/\s+/).slice(0, 6).join(" ");
}

export function ownerProductPhotoReceivedMessage(description: string): string {
  const item = ownerPhotoItemSummary(description) || "item principal";
  const feminine =
    /^(x[ií]cara|caneca|garrafa|comida|pessoa|camisa|moto|motocicleta|embalagem|roupa)\b/i
      .test(item);
  return `Recebi a foto ${
    feminine ? "da" : "do"
  } ${item}. O que você quer fazer?`;
}

export function ownerProductVisionConfirmMessage(description: string): string {
  const seen = ownerPhotoItemSummary(description);
  const body = seen || "itens nesta imagem";
  return `Vi ${body}. É isso?`;
}

export function ownerUncertainVisionConfirmMessage(
  description: string,
): string {
  const seen = ownerPhotoItemSummary(description) ||
    "alguns itens nesta foto";
  return `Não tenho certeza do que é. Vi ${seen}. É um veículo ou outro produto?`;
}

export function ownerRepeatedVisionConfirmMessage(
  description: string,
  route: "produto" | "veiculo",
): string {
  const seen = normalizeOwnerPhotoDescription(description);
  if (route === "veiculo") {
    return seen
      ? `Essa foto você já tinha me mandado. Vi ${seen}. Confirma?`
      : "Essa foto você já tinha me mandado. Confirma que é um veículo?";
  }
  return seen
    ? `Essa foto você já tinha me mandado. Vi ${seen}. É isso?`
    : "Essa foto você já tinha me mandado. Confirma que é produto?";
}

export function ownerPhotoConfirmButtons() {
  return {
    body: "Confirme o que aparece na foto antes de continuar.",
    buttons: [
      { id: "owner_photo:confirm_product", title: "Sim, é produto" },
      { id: "owner_photo:confirm_vehicle", title: "É um veículo" },
      { id: "owner_photo:correct", title: "Corrigir" },
    ],
  };
}

export function ownerAutomotivePhotoConfirmButtons() {
  return {
    body: "Confirme o que aparece na foto antes de continuar.",
    buttons: [
      { id: "owner_photo:confirm_vehicle", title: "É um veículo" },
      { id: "owner_photo:correct", title: "Corrigir" },
    ],
  };
}

export function parseOwnerPhotoConfirmInteractiveId(
  text: string,
): "confirm_product" | "confirm_vehicle" | "correct" | null {
  const id = String(text || "").match(
    /<<INTERACTIVE_ID:(owner_photo:[^>]+)>>/i,
  )?.[1]?.toLowerCase();
  if (id === "owner_photo:confirm_product") return "confirm_product";
  if (id === "owner_photo:confirm_vehicle") return "confirm_vehicle";
  if (id === "owner_photo:correct") return "correct";
  return null;
}

export function ownerPhotoCorrectionPrompt(): string {
  return "Me diga com suas palavras o que aparece na foto (só o que dá para ver).";
}

export function ownerPhotoConfirmedProductTitle(
  description: string,
  correction?: string | null,
): string {
  const corrected = String(correction || "").replace(/\s+/g, " ").trim();
  if (corrected) return corrected.slice(0, 120);
  const seen = ownerPhotoItemSummary(description);
  return seen.slice(0, 120);
}

export function productAdDataPrompt(confirmedTitle: string): string {
  const title = String(confirmedTitle || "").trim();
  return title
    ? `Me mande em uma mensagem preço, itens e condições. Vou usar como título: «${title}». Para outro título, comece a mensagem com ele.`
    : "Me mande em uma mensagem os dados reais do anúncio: título, preço, itens e condições. Vou usar esta foto.";
}
