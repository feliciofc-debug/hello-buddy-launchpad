import {
  captionValues,
  clipCaption,
  normalizeBrazilianWhatsappNumber,
  normalizeCaptionText,
} from "./anuncio-caption-common.ts";

const VEHICLE_CAPTION_LIMIT = 900;

const FORBIDDEN_INFERENCE =
  /\b(u[nú]nico\s+dono|revisad[oa]|garantia|laudo|sem\s+detalhes|baixa\s+km|impec[aá]vel|zero\s+defeitos)\b/i;

function clipVehicleCaption(value: string): string {
  const compact = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
  return compact.length <= VEHICLE_CAPTION_LIMIT
    ? compact
    : compact.slice(0, VEHICLE_CAPTION_LIMIT - 3).replace(/\s+\S*$/, "") +
      "...";
}

function vehicleContactLine(data: Record<string, unknown>): string {
  const phone = normalizeBrazilianWhatsappNumber(
    data.telefone || data.contato || data.link_whatsapp,
  );
  const link = String(data.link_loja || data.link_post || "").trim();
  const wa = phone
    ? `https://wa.me/${phone}`
    : /^https?:\/\//i.test(link)
    ? link
    : "";
  return wa ? `📲 Chame no WhatsApp: ${wa}` : "";
}

function headline(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const value of [data.titulo, data.versao, data.ano]) {
    const part = String(value || "").trim();
    if (!part) continue;
    const existing = normalizeCaptionText(parts.join(" "));
    if (!existing.includes(normalizeCaptionText(part))) parts.push(part);
  }
  return parts.join(" ") || String(data.titulo || "Veículo").trim();
}

function fichaLine(data: Record<string, unknown>): string {
  const bits: string[] = [];
  const ano = String(data.ano || "").trim();
  const km = String(
    data.quilometragem || data.km || "",
  ).trim();
  const cambio = String(data.cambio || "").trim();
  const combustivel = String(
    data.combustivel || data.motor || "",
  ).trim();
  const cor = String(data.cor || "").trim();
  if (ano) bits.push(`📅 ${ano}`);
  if (km) bits.push(`🛣️ ${km}`);
  if (cambio) bits.push(`⚙️ ${cambio}`);
  if (combustivel) bits.push(`⛽ ${combustivel}`);
  if (cor) bits.push(`🎨 ${cor}`);
  return bits.join(" · ");
}

function priceBlock(data: Record<string, unknown>): string {
  const price = String(data.preco || "").trim();
  const fipe = String(data.fipe || data.preco_referencia || "").trim();
  const fipeLabel = String(
    data.preco_referencia_label || (data.fipe ? "FIPE" : ""),
  ).trim();
  const lines: string[] = [];
  if (price) lines.push(`💰 ${price}`);
  if (fipe) {
    lines.push(
      fipeLabel ? `📊 ${fipeLabel}: ${fipe}` : `📊 Referência FIPE: ${fipe}`,
    );
  }
  return lines.join("\n");
}

function informedItems(data: Record<string, unknown>): string[] {
  return [
    ...new Set([
      ...captionValues(data.opcionais),
      ...captionValues(data.itens),
      ...captionValues(data.condicoes),
      ...captionValues(data.documentacao),
      ...captionValues(data.pneus),
      ...captionValues(data.ficha),
    ].filter((item) => item && !FORBIDDEN_INFERENCE.test(item))),
  ];
}

function buildHashtags(data: Record<string, unknown>): string {
  const title = normalizeCaptionText(headline(data)).replace(
    /[^a-z0-9 ]/g,
    " ",
  );
  const tags = new Set<string>(["seminovos", "carros"]);
  for (const word of title.split(/\s+/).filter((w) => w.length >= 3).slice(0, 4)) {
    tags.add(word);
  }
  const cidade = String(data.cidade || data.cidade_loja || "").trim();
  if (cidade) {
    const cityTag = normalizeCaptionText(cidade).replace(/[^a-z0-9]/g, "");
    if (cityTag.length >= 3) tags.add(cityTag);
  }
  return [...tags].slice(0, 8).map((tag) => `#${tag}`).join(" ");
}

function benefitParagraph(data: Record<string, unknown>): string {
  const items = informedItems(data);
  if (!items.length) {
    const versao = String(data.versao || "").trim();
    if (versao) {
      return `Versão ${versao} com o pacote informado pelo anunciante.`;
    }
    return "";
  }
  const picked = items.slice(0, 3);
  if (picked.length === 1) {
    return `${picked[0]}.`;
  }
  if (picked.length === 2) {
    return `${picked[0]}. ${picked[1]}.`;
  }
  return `${picked[0]}. ${picked[1]}. ${picked[2]}.`;
}

function assemble(blocks: string[]): string {
  return clipVehicleCaption(
    blocks.filter(Boolean).join("\n\n"),
  );
}

export function generateVehicleAdCaptions(
  data: Record<string, unknown>,
  variation = 0,
): { A: string; B: string; C: string } {
  const title = headline(data);
  const ficha = fichaLine(data);
  const price = priceBlock(data);
  const contact = vehicleContactLine(data);
  const tags = buildHashtags(data);
  const items = informedItems(data);
  const offset = items.length ? Math.abs(variation) % items.length : 0;
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  const extras = rotated.slice(0, 4).join(", ");

  const a = assemble([
    `🚗 ${title}`,
    ficha,
    price,
    extras ? extras + "." : "",
    contact,
    tags,
  ]);

  const benefits = benefitParagraph(data);
  const b = assemble([
    `🚗 ${title}`,
    benefits,
    ficha,
    price,
    contact,
    tags,
  ]);

  const invite = variation % 2 === 0
    ? `Oportunidade para conhecer o ${title} de perto.`
    : `Venha conhecer o ${title} na loja.`;
  const c = assemble([
    invite,
    ficha,
    extras ? extras + "." : "",
    price,
    contact,
    tags,
  ]);

  return { A: a, B: b, C: c };
}

/** @deprecated product path uses clipCaption limit — kept for tests importing clip behavior */
export { clipCaption };
