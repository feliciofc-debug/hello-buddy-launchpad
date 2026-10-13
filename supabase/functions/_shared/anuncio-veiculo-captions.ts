import {
  captionContactLine,
  captionValues,
  clipCaption,
  normalizeCaptionText,
} from "./anuncio-caption-common.ts";

function hashtags(title: string): string {
  const clean = normalizeCaptionText(title).replace(/[^a-z0-9 ]/g, " ");
  const tags = ["seminovos"];
  if (/\bcitroen\b/.test(clean)) tags.push("citroen");
  if (/\bc3\s+picasso\b/.test(clean)) tags.push("c3picasso");
  if (/\bonix\b/.test(clean)) tags.push("onix");
  tags.push("carrosusados");
  return [...new Set(tags)].slice(0, 6).map((tag) => `#${tag}`).join(" ");
}

function priceLine(data: Record<string, unknown>): string {
  const price = String(data.preco || "").trim();
  const reference = String(data.fipe || data.preco_referencia || "").trim();
  const referenceLabel = String(
    data.preco_referencia_label || (data.fipe ? "FIPE" : ""),
  ).trim();
  const labeledReference = reference
    ? `${reference}${referenceLabel ? ` (${referenceLabel})` : ""}`
    : "";
  if (price && labeledReference) return `De ${labeledReference} por ${price}.`;
  if (price) return `Por ${price}.`;
  if (labeledReference) return `Referência informada: ${labeledReference}.`;
  return "";
}

function modelLine(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const value of [data.titulo, data.versao, data.ano]) {
    const part = String(value || "").trim();
    if (!part) continue;
    const existing = normalizeCaptionText(parts.join(" "));
    if (!existing.includes(normalizeCaptionText(part))) parts.push(part);
  }
  const result = parts.join(" ");
  return result || "Veículo anunciado";
}

function factualHighlights(data: Record<string, unknown>): string[] {
  return [
    ...new Set([
      ...captionValues(data.cambio),
      ...captionValues(data.motor),
      ...captionValues(data.quilometragem),
      ...captionValues(data.km),
      ...captionValues(data.donos),
      ...captionValues(data.documentacao),
      ...captionValues(data.revisoes),
      ...captionValues(data.pneus),
      ...captionValues(data.opcionais),
      ...captionValues(data.condicoes),
      ...captionValues(data.itens),
      ...captionValues(data.ficha),
    ]),
  ];
}

function benefitSentences(data: Record<string, unknown>): string[] {
  const source = factualHighlights(data);
  const normalized = normalizeCaptionText(source.join(" "));
  const benefits: string[] = [];
  if (/\bautomatic/.test(normalized)) {
    benefits.push("Câmbio automático para mais conforto no trânsito.");
  }
  if (/\bipva\b.*\bpago\b/.test(normalized)) {
    benefits.push("IPVA pago: sem esse gasto extra agora.");
  }
  if (/\brevis/.test(normalized)) {
    benefits.push("Revisões informadas ajudam a acompanhar a manutenção.");
  }
  if (
    /\bc3\s+picasso\b/.test(
      normalizeCaptionText(String(data.titulo || "")),
    )
  ) {
    benefits.push("Espaço interno de minivan para a rotina da família.");
  }
  return benefits;
}

export function generateVehicleAdCaptions(
  data: Record<string, unknown>,
  variation = 0,
): { A: string; B: string; C: string } {
  const model = modelLine(data);
  const allFacts = factualHighlights(data);
  const offset = allFacts.length ? Math.abs(variation) % allFacts.length : 0;
  const facts = [...allFacts.slice(offset), ...allFacts.slice(0, offset)];
  const three = facts.slice(0, 3).join(", ");
  const price = priceLine(data);
  const contact = captionContactLine(data);
  const tags = hashtags(String(data.titulo || ""));
  const benefits = benefitSentences(data);
  const a = clipCaption(
    [
      `🚗 ${model}.`,
      three ? `${three}.` : "",
      price,
      tags,
      contact,
    ].filter(Boolean).join(" "),
  );
  const b = clipCaption(
    [
      variation % 2 === 0
        ? `Para a rotina: ${model}.`
        : `Conforto e praticidade no dia a dia: ${model}.`,
      benefits.join(" "),
      facts.slice(0, 5).length ? `${facts.slice(0, 5).join(", ")}.` : "",
      price,
      tags,
      contact,
    ].filter(Boolean).join(" "),
  );
  const c = clipCaption(
    [
      variation % 2 === 0
        ? `O ${model} combina com a sua rotina?`
        : `Que tal conhecer o ${model}?`,
      facts.slice(0, 4).length ? `${facts.slice(0, 4).join(", ")}.` : "",
      price,
      tags,
      contact,
    ].filter(Boolean).join(" "),
  );
  return { A: a, B: b, C: c };
}
