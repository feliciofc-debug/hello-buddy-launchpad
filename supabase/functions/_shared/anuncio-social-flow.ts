import type { AnuncioStyle } from "./anuncio-style.ts";
import {
  type ContentNiche,
  resolveNichoDoConteudo,
} from "./content-niche.ts";

export const LAST_ANUNCIO_TTL_MS = 24 * 60 * 60 * 1000;

export type LastAnuncioImage = {
  style: AnuncioStyle;
  formato: "feed" | "story";
  id: string;
  url: string;
};

export type LastAnuncio = {
  images: LastAnuncioImage[];
  selected_style?: AnuncioStyle;
  vertical?: "geral" | "veiculo";
  niche?: ContentNiche;
  data: Record<string, unknown>;
  render_payload?: Record<string, unknown>;
  client_name?: string | null;
  created_at: string;
};

export type AnuncioPostAction = "publish" | "schedule" | "save";
export type AnuncioPostFormat = "feed" | "story" | "feed_story";
export type AnuncioPostNetwork = "facebook" | "instagram" | "linkedin";

export type AnuncioPostRequest = {
  action?: AnuncioPostAction;
  style?: AnuncioStyle;
  format?: AnuncioPostFormat;
  networks: AnuncioPostNetwork[];
};

export type PendingAnuncioPost = {
  stage:
    | "action"
    | "format"
    | "networks"
    | "captions"
    | "approval"
    | "custom_caption"
    | "schedule_time"
    | "schedule_approval";
  action?: AnuncioPostAction;
  format?: AnuncioPostFormat;
  networks?: AnuncioPostNetwork[];
  token?: string;
  extra_tokens?: string[];
  scheduled_at?: string;
  selected_option?: "A" | "B" | "C" | "personalizada";
  created_at: string;
};

export function validLastAnuncio(
  value: LastAnuncio | null | undefined,
  nowMs = Date.now(),
): value is LastAnuncio {
  if (!value?.images?.length || !value.data || !value.created_at) return false;
  const created = new Date(value.created_at).getTime();
  return Number.isFinite(created) &&
    created <= nowMs &&
    nowMs - created <= LAST_ANUNCIO_TTL_MS;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function parseAnuncioPostRequest(text: string): AnuncioPostRequest {
  const normalized = normalize(text);
  const action = /\b(?:agendar|agenda|agende)\b/.test(normalized)
    ? "schedule"
    : /\b(?:so\s+salvar|salvar|salve|guardar)\b/.test(normalized)
    ? "save"
    : /\b(?:postar|posta|poste|publicar|publique|publica)\b/.test(normalized)
    ? "publish"
    : undefined;
  const hasFeed = /\bfeed\b/.test(normalized);
  const hasStory = /\bstor(?:y|ies|ie)\b/.test(normalized);
  const format = hasFeed && hasStory
    ? "feed_story"
    : hasStory
    ? "story"
    : hasFeed
    ? "feed"
    : undefined;
  const networks: AnuncioPostNetwork[] = [];
  if (/\b(?:facebook|face|fb)\b/.test(normalized)) networks.push("facebook");
  if (/\b(?:instagram|insta|ig)\b/.test(normalized)) networks.push("instagram");
  const style = /\bimpacto\b/.test(normalized)
    ? "impacto"
    : /\bcatalogo\b/.test(normalized)
    ? "catalogo"
    : /\bdestaque\b/.test(normalized)
    ? "destaque"
    : undefined;
  return { action, style, format, networks };
}

export function shouldBindPostToLastAnuncio(input: {
  requestText: string;
  explicitProduct?: string;
  anuncioTitle?: string;
  pendingFlow?: boolean;
}): boolean {
  const parsed = parseAnuncioPostRequest(input.requestText);
  const product = normalize(input.explicitProduct || "").trim();
  if (!product) {
    return input.pendingFlow === true || parsed.action !== undefined;
  }
  if (
    /^(?:esse|essa|este|esta|isso|o|a)?\s*(?:anuncio|arte|carro|veiculo|imagem|foto)$/
      .test(product)
  ) {
    return true;
  }
  const title = normalize(input.anuncioTitle || "");
  if (!title) return false;
  const significantProductWords = product.split(/\s+/).filter((word) =>
    word.length >= 3
  );
  const matchesTitle = significantProductWords.length > 0 &&
    significantProductWords.every((word) => title.includes(word));
  if (matchesTitle) return true;
  // O estilo só vincula o último anúncio quando não existe outro produto
  // explícito. Ex.: "COMEXIA no estilo impacto" continua sendo COMEXIA.
  const styleOnlyProduct = product
    .replace(/^(?:o|a|no|na)?\s*(?:estilo|modelo)\s+/, "")
    .trim();
  return parsed.style === styleOnlyProduct;
}

export function anuncioPostActionButtons() {
  return {
    body:
      "Arte salva na sua biblioteca. O que você quer fazer com este anúncio?",
    buttons: [
      { id: "anuncio_post:action:publish", title: "📤 Publicar agora" },
      { id: "anuncio_post:action:schedule", title: "🗓️ Agendar" },
      { id: "anuncio_other_styles", title: "🎨 Trocar estilo" },
    ],
  };
}

export function canOfferAnuncioPostActions(input: {
  previewsSent: number;
  expectedPreviews: number;
}): boolean {
  return input.expectedPreviews > 0 &&
    input.previewsSent === input.expectedPreviews;
}

export function anuncioPostFormatButtons(schedule = false) {
  return {
    body: schedule
      ? "Agendamento pelo WhatsApp está disponível apenas para Feed."
      : "Selecione uma opção.",
    buttons: schedule ? [{ id: "anuncio_post:format:feed", title: "Feed" }] : [
      { id: "anuncio_post:format:feed", title: "Feed" },
      { id: "anuncio_post:format:story", title: "Story" },
      { id: "anuncio_post:format:feed_story", title: "Feed + Story" },
    ],
  };
}

export function anuncioPostNetworkButtons(
  connected: AnuncioPostNetwork[],
) {
  const facebook = connected.includes("facebook");
  const instagram = connected.includes("instagram");
  const buttons: Array<{ id: string; title: string }> = [];
  if (facebook && instagram) {
    buttons.push({
      id: "anuncio_post:networks:both",
      title: "Facebook + Instagram",
    });
  }
  if (instagram) {
    buttons.push({
      id: "anuncio_post:networks:instagram",
      title: "Só Instagram",
    });
  }
  if (facebook) {
    buttons.push({
      id: "anuncio_post:networks:facebook",
      title: "Só Facebook",
    });
  }
  return { body: "Em quais redes?", buttons };
}

export function anuncioPostDestinationList(input: {
  mediaType: "foto" | "video";
  connected: Array<"facebook" | "instagram" | "linkedin" | "tiktok">;
}) {
  const connected = input.connected;
  const meta = (["facebook", "instagram"] as const).filter((network) =>
    connected.includes(network)
  );
  const metaLabel = meta.length === 2
    ? "Face + Insta"
    : meta[0] === "facebook"
    ? "Facebook"
    : "Instagram";
  const rows: Array<{ id: string; title: string; description?: string }> = [];
  if (input.mediaType === "video") {
    if (meta.length) {
      rows.push({
        id: "anuncio_post:destination:video_reels",
        title: `🎬 Reels ${metaLabel}`,
      });
    }
    if (connected.includes("tiktok")) {
      rows.push({
        id: "anuncio_post:destination:video_tiktok",
        title: "🎵 TikTok",
      });
    }
    if (connected.includes("linkedin")) {
      rows.push({
        id: "anuncio_post:destination:video_linkedin",
        title: "💼 LinkedIn",
      });
    }
    if (meta.length) {
      rows.push({
        id: "anuncio_post:destination:video_story",
        title: "📱 Story",
      });
    }
  } else {
    if (meta.length) {
      rows.push({
        id: "anuncio_post:destination:photo_feed",
        title: `📤 ${metaLabel} (Feed)`,
      }, {
        id: "anuncio_post:destination:photo_feed_story",
        title: `📤 ${metaLabel}`,
        description: "Feed + Story",
      }, {
        id: "anuncio_post:destination:photo_story",
        title: "📱 Só Story",
      });
    }
    if (connected.includes("linkedin")) {
      rows.push({
        id: "anuncio_post:destination:photo_linkedin",
        title: "💼 LinkedIn",
      });
    }
  }
  rows.push({
    id: "anuncio_post:destination:schedule",
    title: "🗓️ Agendar",
  });
  return {
    body: "Onde você quer publicar?",
    button: "Escolher destino",
    section_title: "Redes conectadas",
    rows: rows.slice(0, 10),
  };
}

export function anuncioRemainingDestinationsList(input: {
  mediaType: "foto" | "video";
  connected: Array<"facebook" | "instagram" | "linkedin" | "tiktok">;
}) {
  const rows = anuncioPostDestinationList(input).rows.filter((row) =>
    row.id !== "anuncio_post:destination:schedule"
  );
  if (!rows.length) return undefined;
  return {
    body: "Quer publicar também em:",
    button: "Escolher rede",
    section_title: "Redes restantes",
    rows,
  };
}

export function anuncioCaptionExtraList() {
  return {
    body: "Quer outras opções ou prefere escrever?",
    button: "Mais opções",
    section_title: "Legenda",
    rows: [
      { id: "anuncio_post:caption:regenerate", title: "Gerar outras" },
      { id: "anuncio_post:caption:custom", title: "Escrever a minha" },
    ],
  };
}

export function anuncioCaptionChoiceMessage(
  variants: Record<string, { A: string; B: string; C: string }>,
): string {
  const first = Object.values(variants)[0];
  if (!first) return "Não consegui montar as opções de legenda.";
  return [
    "Preparei 3 opções de legenda:",
    `*Opção A*\n${first.A}`,
    `*Opção B*\n${first.B}`,
    `*Opção C*\n${first.C}`,
  ].join("\n\n");
}

export function anuncioActionAfterCaption(
  action: AnuncioPostAction | undefined,
): "publish" | "schedule_time" {
  return action === "schedule" ? "schedule_time" : "publish";
}

export function anuncioFinalApprovalButtons(token: string) {
  return {
    body: "Revise o resumo e confirme:",
    buttons: [
      { id: `anuncio_post:confirm:${token}`, title: "Publicar" },
      { id: `anuncio_post:cancel:${token}`, title: "Cancelar" },
    ],
  };
}

export function anuncioScheduleApprovalButtons(token: string) {
  return {
    body: "Revise o resumo e confirme:",
    buttons: [
      { id: `anuncio_post:schedule_confirm:${token}`, title: "Agendar" },
      { id: `anuncio_post:cancel:${token}`, title: "Cancelar" },
    ],
  };
}

export function anuncioScheduleTimeButtons(token: string) {
  return {
    body: "Envie a data e hora ou cancele.",
    buttons: [
      { id: `anuncio_post:cancel:${token}`, title: "Cancelar" },
    ],
  };
}

function values(value: unknown): string[] {
  return (Array.isArray(value) ? value : value == null ? [] : [value])
    .flatMap((item) => String(item).split(","))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function hashtags(title: string): string {
  const clean = normalize(title).replace(/[^a-z0-9 ]/g, " ");
  const tags = ["seminovos"];
  if (/\bcitroen\b/.test(clean)) tags.push("citroen");
  if (/\bc3\s+picasso\b/.test(clean)) tags.push("c3picasso");
  if (/\bonix\b/.test(clean)) tags.push("onix");
  tags.push("carrosusados");
  return [...new Set(tags)].slice(0, 6).map((tag) => `#${tag}`).join(" ");
}

export function normalizeBrazilianWhatsappNumber(value: unknown): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : "";
}

export function formatBrazilianWhatsappNumber(value: unknown): string {
  const digits = normalizeBrazilianWhatsappNumber(value).replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return "";
}

export function singleWhatsappCtaAtEnd(
  caption: string,
  phone: unknown,
): string {
  const digits = normalizeBrazilianWhatsappNumber(phone);
  const body = String(caption || "")
    .replace(
      /^.*(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?\d{4})[\s.-]+\d{4}.*$/gim,
      " ",
    )
    .replace(
      /(?:📱\s*)?(?:fale|chame|falar)\s+(?:comigo\s+)?(?:agora\s+)?(?:no|pelo)\s+whatsapp\s*:?\s*(?:https?:\/\/)?wa\.me\/\d+/gi,
      " ",
    )
    .replace(/(?:https?:\/\/)?wa\.me\/\d+/gi, " ")
    .replace(/\b(?:55)?\d{10,11}\b/g, " ")
    .replace(
      /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?\d{4})[\s.-]+\d{4}\b/g,
      " ",
    )
    .replace(/^[ \t]*(?:📱\s*)?whatsapp\s*:?\s*$/gim, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!digits) return body;
  return [
    body,
    `📱 Chame no WhatsApp: https://wa.me/${digits}`,
  ].filter(Boolean).join("\n\n");
}

function contactLine(data: Record<string, unknown>): string {
  const phone = normalizeBrazilianWhatsappNumber(
    data.telefone || data.contato,
  );
  return phone ? `📱 Chame no WhatsApp: https://wa.me/${phone}` : "";
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
    const existing = normalize(parts.join(" "));
    if (!existing.includes(normalize(part))) parts.push(part);
  }
  const result = parts.join(" ");
  return result || "Veículo anunciado";
}

function factualHighlights(data: Record<string, unknown>): string[] {
  return [
    ...new Set([
      ...values(data.cambio),
      ...values(data.motor),
      ...values(data.quilometragem),
      ...values(data.km),
      ...values(data.donos),
      ...values(data.documentacao),
      ...values(data.revisoes),
      ...values(data.pneus),
      ...values(data.opcionais),
      ...values(data.condicoes),
      ...values(data.itens),
      ...values(data.ficha),
    ]),
  ];
}

function benefitSentences(data: Record<string, unknown>): string[] {
  const source = factualHighlights(data);
  const normalized = normalize(source.join(" "));
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
  if (/\bc3\s+picasso\b/.test(normalize(String(data.titulo || "")))) {
    benefits.push("Espaço interno de minivan para a rotina da família.");
  }
  return benefits;
}

function clip(value: string): string {
  const compact = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
  return compact.length <= 600
    ? compact
    : compact.slice(0, 597).replace(/\s+\S*$/, "") + "...";
}

export function anuncioContentNiche(
  last: Pick<LastAnuncio, "niche" | "vertical">,
): ContentNiche {
  if (last.niche) return last.niche;
  return resolveNichoDoConteudo(
    last.vertical === "veiculo" ? "automotivo" : "geral",
    last.vertical === "veiculo" ? "veiculo" : "produto",
  );
}

function productTags(title: string): string {
  const words = normalize(title).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 4);
  return [...new Set(words)].map((word) => `#${word}`).join(" ");
}

export function generateProductAdCaptions(
  data: Record<string, unknown>,
): { A: string; B: string; C: string } {
  const title = String(data.titulo || "Produto").trim();
  const facts = [
    ...values(data.itens),
    ...values(data.condicoes),
    ...values(data.ficha),
  ];
  const details = facts.length ? facts.join(", ") + "." : "";
  const price = String(data.preco || "").trim();
  const priceText = price ? `Valor informado: ${price}.` : "";
  const whatsapp = contactLine(data);
  const tags = productTags(title);
  const finish = (lead: string) =>
    clip(
      [lead, details, priceText, tags, whatsapp].filter(Boolean).join("\n\n"),
    );
  return {
    A: finish(`✨ ${title}`),
    B: finish(`Conheça ${title}.`),
    C: finish(`Quer saber mais sobre ${title}?`),
  };
}

export function generateVehicleAdCaptions(
  data: Record<string, unknown>,
  variation = 0,
  niche: ContentNiche = "produto",
): { A: string; B: string; C: string } {
  if (niche !== "veiculo") return generateProductAdCaptions(data);
  const model = modelLine(data);
  const allFacts = factualHighlights(data);
  const offset = allFacts.length ? Math.abs(variation) % allFacts.length : 0;
  const facts = [...allFacts.slice(offset), ...allFacts.slice(0, offset)];
  const three = facts.slice(0, 3).join(", ");
  const price = priceLine(data);
  const contact = contactLine(data);
  const tags = hashtags(String(data.titulo || ""));
  const benefits = benefitSentences(data);
  const a = clip(
    [
      `🚗 ${model}.`,
      three ? `${three}.` : "",
      price,
      tags,
      contact,
    ].filter(Boolean).join(" "),
  );
  const b = clip(
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
  const c = clip(
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

export function chooseAnuncioPostSource<T>(
  last: LastAnuncio | null | undefined,
  fallback: T,
  nowMs = Date.now(),
): LastAnuncio | T {
  return validLastAnuncio(last, nowMs) ? last : fallback;
}
