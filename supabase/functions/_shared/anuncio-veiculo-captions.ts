import {
  captionValues,
  clipCaption,
  normalizeBrazilianWhatsappNumber,
  normalizeCaptionText,
} from "./anuncio-caption-common.ts";
import {
  filterVehicleHashtagToken,
  isMotorcycleVehicle,
  isVehicleAdNarrativeLeak,
  isVisionSceneDescription,
  vehicleBrandHashtags,
  vehicleLeadEmoji,
  vehicleModelHashtag,
} from "./vehicle-social-identity.ts";

const VEHICLE_CAPTION_LIMIT = 900;

const FORBIDDEN_INFERENCE =
  /\b(u[nú]nico\s+dono|revisad[oa]|garantia|laudo|sem\s+detalhes|baixa\s+km|impec[aá]vel|zero\s+defeitos)\b/i;

const LONE_EMOJI_LINE =
  /^[\s📲📱🚗🏍️🛣️🎨💰📅⛽⚙️👉]+$/u;

export function cleanVehicleTitle(data: Record<string, unknown>): string {
  let title = String(data.titulo || "").trim();
  if (isVisionSceneDescription(title)) {
    const marca = String(data.marca || "").trim();
    const modelo = String(data.modelo || "").trim();
    title = [marca, modelo].filter(Boolean).join(" ").trim() || "Veículo";
  }
  title = title
    .replace(/\s*[\/|]\s*\d[\d.,]*\s*km[^.]*\.?\s*.*$/i, "")
    .replace(/\s*[\/|]\s*[A-Za-zÀ-ú]+\s*\.?\s*$/i, "")
    .replace(/\s+\/\s+/g, " ")
    .trim();
  const versao = String(data.versao || "").trim();
  const ano = String(data.ano || "").trim();
  const base = title || versao || "Veículo";
  if (ano && !normalizeCaptionText(base).includes(normalizeCaptionText(ano))) {
    return `${base} ${ano}`.trim();
  }
  return base;
}

function clipVehicleCaption(value: string): string {
  const compact = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
  return compact.length <= VEHICLE_CAPTION_LIMIT
    ? compact
    : compact.slice(0, VEHICLE_CAPTION_LIMIT - 3).replace(/\s+\S*$/, "") +
      "...";
}

export function vehicleContactLine(data: Record<string, unknown>): string {
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

export function vehicleDataLine(data: Record<string, unknown>): string {
  const bits: string[] = [];
  const ano = String(data.ano || "").trim();
  const km = String(data.quilometragem || data.km || "").trim();
  const cor = String(data.cor || "").trim();
  const price = String(data.preco || "").trim();
  if (ano) bits.push(`📅 ${ano}`);
  if (km) bits.push(`🛣️ ${km}`);
  if (cor) bits.push(`🎨 ${cor}`);
  if (price) bits.push(`💰 ${price}`);
  return bits.join(" · ");
}

function buildHashtags(data: Record<string, unknown>): string {
  const motorcycle = isMotorcycleVehicle(data);
  const tags = new Set<string>(
    motorcycle ? ["seminovas", "motos"] : ["seminovos", "carros"],
  );
  const marca = String(data.marca || "").trim();
  const modelo = String(data.modelo || "").trim();
  for (const tag of vehicleBrandHashtags(marca, motorcycle)) tags.add(tag);
  const modelTag = vehicleModelHashtag(modelo);
  if (modelTag) tags.add(modelTag);

  const title = normalizeCaptionText(cleanVehicleTitle(data)).replace(
    /[^a-z0-9 ]/g,
    " ",
  );
  for (const word of title.split(/\s+/).filter(filterVehicleHashtagToken).slice(0, 3)) {
    tags.add(word.replace(/[^a-z0-9]/g, ""));
  }
  const cidade = String(data.cidade || data.cidade_loja || "").trim();
  if (cidade) {
    const cityTag = normalizeCaptionText(cidade).replace(/[^a-z0-9]/g, "");
    if (cityTag.length >= 3 && filterVehicleHashtagToken(cityTag)) tags.add(cityTag);
  }
  return [...tags].slice(0, 8).map((tag) => `#${tag}`).join(" ");
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

function normalizeFact(value: string): string {
  return normalizeCaptionText(value).replace(/\s+/g, " ");
}

export function sanitizeVehicleAdLines(text: string): string {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !LONE_EMOJI_LINE.test(line))
    .filter((line) => !/^📲\s*$/.test(line))
    .join("\n")
    .trim();
}

export function stripDuplicateVehicleFacts(
  text: string,
  data: Record<string, unknown>,
): string {
  const km = normalizeFact(String(data.quilometragem || data.km || ""));
  const cor = normalizeFact(String(data.cor || ""));
  const price = normalizeFact(String(data.preco || ""));
  const title = normalizeFact(cleanVehicleTitle(data));
  return text
    .split("\n")
    .filter((line) => {
      const norm = normalizeFact(line);
      if (!norm) return false;
      if (norm === title || norm.includes(`🚗 ${title}`) || norm.includes(`🏍️ ${title}`)) {
        return false;
      }
      const kmHits = km && norm.includes(km) &&
        /km|quilometragem|🛣️/i.test(line);
      const corHits = cor && norm.includes(cor) &&
        /🎨|cor\b/i.test(line);
      const priceHits = price && norm.includes(normalizeFact(price)) &&
        /💰|preco|preço|r\$/i.test(line);
      if (kmHits && corHits) return false;
      if (kmHits && /🛣️|km/i.test(line) && line.split("·").length <= 3) {
        return false;
      }
      if (corHits && /🎨|cor/i.test(line) && line.length < 40) return false;
      if (priceHits && /💰|r\$/i.test(line) && line.length < 35) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export function vehicleAnuncioFactsForAi(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const keys = [
    "titulo",
    "tipo_veiculo",
    "tipo",
    "carroceria",
    "versao",
    "ano",
    "quilometragem",
    "km",
    "cor",
    "cambio",
    "combustivel",
    "motor",
    "preco",
    "fipe",
    "preco_referencia",
    "opcionais",
    "itens",
    "condicoes",
    "documentacao",
    "pneus",
    "ficha",
    "cidade",
    "cidade_loja",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = data[key];
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export function vehicleAnuncioAiBriefing(data: Record<string, unknown>): string {
  const facts = vehicleAnuncioFactsForAi(data);
  return [
    "Use SOMENTE os dados JSON abaixo sobre o veículo.",
    "Não invente opcionais, revisão, garantia, laudo, financiamento ou preço.",
    "Não escreva telefone, wa.me, link de WhatsApp nem bloco de hashtags — o servidor adiciona.",
    "Escreva só o corpo persuasivo (2 a 3 frases) no estilo pedido; sem repetir km, cor e preço em linha separada.",
    `Dados: ${JSON.stringify(facts)}`,
  ].join(" ");
}

function styleCta(style: "A" | "B" | "C", data: Record<string, unknown>): string {
  const title = cleanVehicleTitle(data);
  const motorcycle = isMotorcycleVehicle(data);
  if (style === "A") {
    return motorcycle
      ? `👉 Quer sentir a pegada do ${title}? Chame no WhatsApp e agende um test ride.`
      : `👉 Quer ver o ${title} de perto? Chame no WhatsApp e agende sua visita.`;
  }
  if (style === "B") {
    return motorcycle
      ? `🛣️ Vem conhecer o ${title} pessoalmente — a estrada começa na loja.`
      : `☕ Vem conhecer o ${title} pessoalmente — a experiência ao vivo faz diferença.`;
  }
  return motorcycle
    ? `💬 Curioso para pilotar o ${title}? Me chama no WhatsApp e marcamos um horário.`
    : `💬 Curioso para sentir o ${title}? Me chama no WhatsApp e marcamos um horário.`;
}

function fallbackSalesParagraphs(
  style: "A" | "B" | "C",
  data: Record<string, unknown>,
): string {
  const title = cleanVehicleTitle(data);
  const km = String(data.quilometragem || data.km || "").trim();
  const motorcycle = isMotorcycleVehicle(data);
  const items = informedItems(data).slice(0, 2);
  const itemHint = items.length
    ? ` Destaque informado: ${items.join(" e ")}.`
    : "";
  if (style === "A") {
    return motorcycle
      ? [
        `${title} com postura esportiva e presença de vitrine — pronta para despertar vontade de pilotar.`,
        km
          ? `Km informado na ficha: dá para ir direto ao ponto e marcar um test ride.${itemHint}`
          : `Uma escolha direta para quem quer sentir liberdade sobre duas rodas.${itemHint}`,
      ].join(" ")
      : [
        `O ${title} aparece com presença forte — ideal para quem busca estilo e conforto no volante.`,
        km
          ? `É uma escolha objetiva para sair do papo e ir direto à visita.${itemHint}`
          : `Uma oportunidade clara para conhecer o veículo antes de decidir.${itemHint}`,
      ].join(" ");
  }
  if (style === "B") {
    return motorcycle
      ? [
        `Imagine acelerar na estrada com o ${title} — vento na cara e sensação de liberdade.`,
        km
          ? `Cada km conta uma história; o próximo trecho pode ser seu.${itemHint}`
          : `Duas rodas, estilo marcante e aquele clima de conquista a cada curva.${itemHint}`,
      ].join(" ")
      : [
        `Imagine receber visitas na loja e ver o ${title} como protagonista na vitrine.`,
        km
          ? `História rodada com transparência — pronta para o próximo capítulo.${itemHint}`
          : `Cada detalhe conta quando você escolhe com calma e vê o veículo ao vivo.${itemHint}`,
      ].join(" ");
  }
  return motorcycle
    ? [
      `Procura uma moto como o ${title} para transformar o trajeto em prazer?`,
      km
        ? `Compare com calma: o que importa é sentir a pegada e a postura na pilotagem.${itemHint}`
        : `O próximo passo é simples: conhecer de perto e sentir se combina com seu estilo.${itemHint}`,
    ].join(" ")
    : [
      `Procura um ${title} que combine estilo e praticidade para o dia a dia?`,
      km
        ? `Dá para comparar com tranquilidade: o que importa é sentir o carro pessoalmente.${itemHint}`
        : `O próximo passo é simples: conhecer de perto e tirar suas dúvidas na hora.${itemHint}`,
    ].join(" ");
}

function assemble(blocks: string[]): string {
  return clipVehicleCaption(
    blocks.filter(Boolean).join("\n\n"),
  );
}

export function composeVehicleAdVariant(
  rawCopy: string,
  data: Record<string, unknown>,
  style: "A" | "B" | "C",
): string {
  let narrative = stripDuplicateVehicleFacts(
    sanitizeVehicleAdLines(rawCopy),
    data,
  );
  narrative = narrative.replace(/^[🚗🏍️]\s*/u, "").trim();
  if (narrative.length < 40 || isVehicleAdNarrativeLeak(narrative)) {
    narrative = fallbackSalesParagraphs(style, data);
  }
  const title = `${vehicleLeadEmoji(data)} ${cleanVehicleTitle(data)}`;
  const dataLine = vehicleDataLine(data);
  const cta = styleCta(style, data);
  const tags = buildHashtags(data);
  const contact = vehicleContactLine(data);
  return assemble([title, narrative, dataLine, cta, tags, contact]);
}

export function generateVehicleAdCaptions(
  data: Record<string, unknown>,
  variation = 0,
): { A: string; B: string; C: string } {
  const offset = Math.abs(variation) % 3;
  const styles: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  const rotated = [...styles.slice(offset), ...styles.slice(0, offset)];
  return {
    A: composeVehicleAdVariant("", data, rotated[0]),
    B: composeVehicleAdVariant("", data, rotated[1]),
    C: composeVehicleAdVariant("", data, rotated[2]),
  };
}

/** @deprecated product path uses clipCaption limit — kept for tests importing clip behavior */
export { clipCaption };
