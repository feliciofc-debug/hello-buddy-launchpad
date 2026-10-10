import {
  captionContactLine,
  captionValues,
  clipCaption,
  normalizeCaptionText,
} from "./anuncio-caption-common.ts";

function productTags(title: string): string {
  const words = normalizeCaptionText(title).replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 4);
  return [...new Set(words)].map((word) => `#${word}`).join(" ");
}

export function generateProductAdCaptions(
  data: Record<string, unknown>,
): { A: string; B: string; C: string } {
  const title = String(data.titulo || "Produto").trim();
  const facts = [
    ...captionValues(data.itens),
    ...captionValues(data.condicoes),
    ...captionValues(data.ficha),
  ];
  const details = facts.length ? facts.join(", ") + "." : "";
  const price = String(data.preco || "").trim();
  const priceText = price ? `Valor informado: ${price}.` : "";
  const whatsapp = captionContactLine(data);
  const tags = productTags(title);
  const finish = (lead: string) =>
    clipCaption(
      [lead, details, priceText, tags, whatsapp].filter(Boolean).join("\n\n"),
    );
  return {
    A: finish(`✨ ${title}`),
    B: finish(`Conheça ${title}.`),
    C: finish(`Quer saber mais sobre ${title}?`),
  };
}
