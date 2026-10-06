import type { AnuncioPhotoPreference } from "./anuncio-style.ts";

export const VEHICLE_CAROUSEL_TTL_MS = 30 * 60 * 1000;
export const VEHICLE_PHOTO_BATCH_TTL_MS = 3 * 60 * 1000;
export const VEHICLE_CAROUSEL_MAX_PHOTOS = 8;
export const VEHICLE_CAROUSEL_MIN_PHOTOS = 2;
export const VEHICLE_CAROUSEL_STRIP_RATIO = 0.18;

export type VehicleCarouselFormat = "portrait" | "square";
export type VehiclePhotoView =
  | "Frente"
  | "Lateral"
  | "Traseira"
  | "3/4"
  | "Interior"
  | "Painel"
  | "Bancos"
  | "Porta-malas"
  | "Motor"
  | "Rodas"
  | "Veículo";

export type VehicleCarouselPhoto = {
  id: string;
  url: string;
  reused?: boolean;
  view?: VehiclePhotoView;
  box?: [number, number, number, number] | null;
};

export type VehicleCarouselData = {
  titulo?: string;
  versao?: string;
  ano?: string;
  preco?: string;
  fipe?: string;
  fipe_mes?: string;
  quilometragem?: string;
  cambio?: string;
  motor?: string;
  donos?: string;
  documentacao?: string;
  revisoes?: string;
  condicoes?: string[];
  contato?: string;
  opcionais?: string[];
};

export type VehicleCarouselSlide = {
  type: "cover" | "content" | "cta";
  photo_url?: string;
  photo_box?: [number, number, number, number] | null;
  title: string;
  body?: string;
  reference?: string;
  number: number;
};

export type GeneratedCarouselContent = {
  slides?: Array<{
    type?: "cover" | "content" | "cta";
    title?: string;
    body?: string;
    number?: number;
  }>;
  caption?: string;
};

export type PendingVehicleCarousel = {
  stage:
    | "collecting"
    | "data_choice"
    | "awaiting_data"
    | "photo_choice"
    | "format_choice"
    | "rendering"
    | "delivered"
    | "network_choice"
    | "caption_choice"
    | "approval";
  photos: VehicleCarouselPhoto[];
  data?: VehicleCarouselData;
  suggested_data?: VehicleCarouselData;
  client_name?: string | null;
  photo_preference?: AnuncioPhotoPreference;
  format: VehicleCarouselFormat;
  media_id?: string;
  image_urls?: string[];
  caption?: string;
  token?: string;
  created_at: string;
};

export type PendingVehiclePhotoBatch = {
  stage: "collecting" | "offered";
  photos: VehicleCarouselPhoto[];
  event_ids?: string[];
  reused_photo_ids?: string[];
  created_at: string;
  last_photo_at: string;
};

function normalize(value: string): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isVehiclePhotoCarouselRequest(text: string): boolean {
  const value = normalize(text);
  const carouselWord =
    /\b(carrossel|carrosel|carrocel|carossel|carosel|carroussel|carousel)\b/
      .test(value) ||
    /\b(album|galeria)\s+de\s+fotos?\b/.test(value);
  return carouselWord &&
    /\b(carro|veiculo|automovel|fotos?|moto(?:cicleta)?)\b/.test(value);
}

export function isVehiclePhotoCarouselTextRequest(text: string): boolean {
  return !/<<INTERACTIVE_ID:/i.test(text) &&
    isVehiclePhotoCarouselRequest(text);
}

export function vehicleCarouselStartState(
  photos: VehicleCarouselPhoto[] = [],
  clientName?: string | null,
  now = new Date(),
): PendingVehicleCarousel {
  return {
    stage: "collecting",
    photos: addVehicleCarouselPhotos([], photos).photos,
    format: "portrait",
    client_name: clientName,
    created_at: now.toISOString(),
  };
}

export function vehicleCarouselAdStateReset() {
  return {
    pending_anuncio_cliente: null,
    pending_anuncio_styles: null,
    pending_anuncio_photo: null,
    pending_anuncio_post: null,
  } as const;
}

export function vehiclePhotoBatchNewTopicReset() {
  return {
    ...vehicleCarouselAdStateReset(),
    pending_carrossel_veiculo: null,
  } as const;
}

export function validPendingVehiclePhotoBatch(
  state: PendingVehiclePhotoBatch | null | undefined,
  nowMs = Date.now(),
): state is PendingVehiclePhotoBatch {
  const updated = new Date(state?.last_photo_at || "").getTime();
  return !!state && Number.isFinite(updated) && updated <= nowMs &&
    nowMs - updated <= VEHICLE_PHOTO_BATCH_TTL_MS;
}

export function vehiclePhotoBatchButtons() {
  return {
    body: "Recebi várias fotos. Escolha o que quer fazer:",
    buttons: [
      {
        id: "vehicle_photo_batch:carousel",
        title: "Carrossel de fotos",
      },
      {
        id: "vehicle_photo_batch:ad",
        title: "Anúncio (1 foto)",
      },
      {
        id: "vehicle_photo_batch:none",
        title: "Nada agora",
      },
    ],
  };
}

export function validPendingVehicleCarousel(
  state: PendingVehicleCarousel | null | undefined,
  nowMs = Date.now(),
): state is PendingVehicleCarousel {
  const created = new Date(state?.created_at || "").getTime();
  return !!state && Number.isFinite(created) && created <= nowMs &&
    nowMs - created <= VEHICLE_CAROUSEL_TTL_MS;
}

export function vehicleCarouselCollectionButtons() {
  return {
    body: "Envie as fotos em ordem e toque em Pronto quando terminar.",
    buttons: [
      { id: "vehicle_carousel:photos:done", title: "Pronto" },
      { id: "vehicle_carousel:cancel", title: "Cancelar" },
    ],
  };
}

export function vehicleCarouselNeedMoreButtons(received: number) {
  return {
    body:
      `Preciso de pelo menos ${VEHICLE_CAROUSEL_MIN_PHOTOS} fotos. Recebi ${received} até agora.`,
    buttons: [
      {
        id: "vehicle_carousel:photos:add",
        title: "Adicionar fotos",
      },
      { id: "vehicle_carousel:cancel", title: "Cancelar" },
    ],
  };
}

export function hasEnoughVehicleCarouselPhotos(count: number): boolean {
  return count >= VEHICLE_CAROUSEL_MIN_PHOTOS;
}

export function vehicleCarouselDataButtons() {
  return {
    body: "Quer aproveitar os dados que já tenho deste veículo?",
    buttons: [
      {
        id: "vehicle_carousel:data:last",
        title: "Usar último anúncio",
      },
      { id: "vehicle_carousel:data:new", title: "Informar outros" },
    ],
  };
}

export function vehicleCarouselPhotoButtons() {
  return {
    body: "Como quer as fotos do carrossel?",
    buttons: [
      {
        id: "vehicle_carousel:photo:original",
        title: "Foto original",
      },
      {
        id: "vehicle_carousel:photo:melhorada",
        title: "Melhorar fundo e luz",
      },
    ],
  };
}

export function vehicleCarouselFormatButtons() {
  return {
    body: "Qual formato do carrossel?",
    buttons: [
      { id: "vehicle_carousel:format:portrait", title: "Feed 4:5" },
      { id: "vehicle_carousel:format:square", title: "Quadrado 1:1" },
    ],
  };
}

export function vehicleCarouselDeliveryButtons() {
  return {
    body: "O que você quer fazer com este carrossel?",
    buttons: [
      { id: "vehicle_carousel:deliver", title: "Enviar para cliente" },
      { id: "vehicle_carousel:publish", title: "Publicar nas redes" },
      { id: "vehicle_carousel:save", title: "Só salvar" },
    ],
  };
}

export function vehicleSingleRepeatedPhotoButtons() {
  return {
    body: "Escolha o que quer fazer com esta foto:",
    buttons: [
      { id: "vehicle_photo_batch:ad", title: "Anúncio" },
      { id: "vehicle_photo_batch:carousel", title: "Carrossel" },
      { id: "vehicle_photo_batch:none", title: "Nada agora" },
    ],
  };
}

export function vehiclePhotoBatchOfferMessage(
  state: PendingVehiclePhotoBatch,
): string {
  const reusedCount = state.reused_photo_ids?.length ?? 0;
  return `Recebi ${state.photos.length} fotos. O que quer fazer?${
    reusedCount > 0
      ? `\n\n(${reusedCount} ${
        reusedCount === 1 ? "dela você já tinha" : "delas você já tinha"
      } me mandado antes.)`
      : ""
  }`;
}

export const SINGLE_REPEATED_VEHICLE_PHOTO_MESSAGE =
  "Essa foto você já tinha me mandado. Quer usar ela agora?";

type PendingWithTimestamp =
  | {
    stage?: string;
    created_at?: string;
    at?: string;
    identidade?: string;
  }
  | null
  | undefined;

export type VehicleBatchFlowState = {
  pending_carrossel_veiculo?: PendingVehicleCarousel | null;
  pending_image_composition?: PendingWithTimestamp;
  pending_client_logo_intent?: PendingWithTimestamp;
  pending_brand_generation?: PendingWithTimestamp;
  pending_video_setup?: PendingWithTimestamp;
  pending_anuncio_photo?: PendingWithTimestamp;
  pending_anuncio_cliente?: PendingWithTimestamp;
  pending_anuncio_styles?: PendingWithTimestamp;
  pending_anuncio_post?: PendingWithTimestamp;
  [key: string]: unknown;
};

function pendingAgeMs(
  value: PendingWithTimestamp,
  nowMs: number,
): number {
  const timestamp = new Date(value?.created_at || value?.at || "").getTime();
  return Number.isFinite(timestamp) && timestamp <= nowMs
    ? nowMs - timestamp
    : Number.POSITIVE_INFINITY;
}

export function blockingVehiclePhotoFlow(
  state: VehicleBatchFlowState,
  nowMs = Date.now(),
): string | null {
  const recent = (value: PendingWithTimestamp) =>
    pendingAgeMs(value, nowMs) <= 10 * 60 * 1000;
  if (
    state.pending_carrossel_veiculo?.stage === "collecting" &&
    recent(state.pending_carrossel_veiculo)
  ) return "pending_carrossel_veiculo";
  if (recent(state.pending_image_composition)) {
    return "pending_image_composition";
  }
  if (recent(state.pending_client_logo_intent)) {
    return "pending_client_logo";
  }
  if (
    state.pending_brand_generation?.stage === "awaiting_logo_upload" &&
    recent(state.pending_brand_generation)
  ) return "pending_brand_generation";
  if (
    state.pending_video_setup?.identidade === "client" &&
    recent(state.pending_video_setup)
  ) return "pending_video_setup";
  if (
    state.pending_anuncio_photo?.stage === "awaiting_photo" &&
    recent(state.pending_anuncio_photo)
  ) return "pending_anuncio_photo";
  return null;
}

export function expiredAnuncioPendingPatch(
  state: VehicleBatchFlowState,
  nowMs = Date.now(),
): Record<string, null> {
  const patch: Record<string, null> = {};
  const candidates = {
    pending_anuncio_post: state.pending_anuncio_post,
    pending_anuncio_styles: state.pending_anuncio_styles,
    pending_anuncio_photo: state.pending_anuncio_photo,
    pending_anuncio_cliente: state.pending_anuncio_cliente,
  };
  for (const [key, value] of Object.entries(candidates)) {
    if (value && pendingAgeMs(value, nowMs) > 30 * 60 * 1000) {
      patch[key] = null;
    }
  }
  return patch;
}

export function planVehiclePhotoBatch(input: {
  previous?: PendingVehiclePhotoBatch | null;
  recentPhotos: VehicleCarouselPhoto[];
  incomingPhotos?: VehicleCarouselPhoto[];
  currentEventId?: string;
  reusedPhotoIds?: string[];
  currentPhotoId?: string;
  hasNewerQueuedPhoto?: boolean;
  now?: Date;
}): {
  state: PendingVehiclePhotoBatch;
  shouldOffer: boolean;
  currentPhotoIsLatest: boolean;
} {
  const now = input.now ?? new Date();
  const photos = addVehicleCarouselPhotos(
    input.previous?.photos ?? [],
    [...input.recentPhotos, ...(input.incomingPhotos ?? [])],
  ).photos;
  const eventIds = [
    ...(input.previous?.event_ids ?? []),
    ...(input.currentEventId ? [input.currentEventId] : []),
  ].filter((id, index, all) => id && all.indexOf(id) === index);
  const reusedPhotoIds = [
    ...(input.previous?.reused_photo_ids ?? []),
    ...(input.reusedPhotoIds ?? []),
  ].filter((id, index, all) => id && all.indexOf(id) === index);
  const currentPhotoIsLatest = !input.hasNewerQueuedPhoto &&
    (!!input.currentEventId || (!!input.currentPhotoId &&
      photos.at(-1)?.id === input.currentPhotoId));
  const shouldOffer = photos.length >= 2 &&
    currentPhotoIsLatest &&
    input.previous?.stage !== "offered";
  return {
    state: {
      stage: input.previous?.stage === "offered" || shouldOffer
        ? "offered"
        : "collecting",
      photos,
      event_ids: eventIds,
      reused_photo_ids: reusedPhotoIds,
      created_at: input.previous?.created_at || now.toISOString(),
      last_photo_at: now.toISOString(),
    },
    shouldOffer,
    currentPhotoIsLatest,
  };
}

export function addVehicleCarouselPhotos(
  current: VehicleCarouselPhoto[],
  incoming: VehicleCarouselPhoto[],
): { photos: VehicleCarouselPhoto[]; ignored: number } {
  const existing = new Set(current.map((photo) => photo.id));
  const unique = incoming.filter((photo) => {
    if (!photo.id || !photo.url || existing.has(photo.id)) return false;
    existing.add(photo.id);
    return true;
  });
  const combined = [...current, ...unique];
  return {
    photos: combined.slice(0, VEHICLE_CAROUSEL_MAX_PHOTOS),
    ignored: Math.max(0, combined.length - VEHICLE_CAROUSEL_MAX_PHOTOS),
  };
}

export function parseVehicleCarouselData(text: string): VehicleCarouselData {
  const source = String(text || "")
    .replace(/^🎙️\s*áudio transcrito:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const knownLabels =
    "modelo|vers[aã]o|ano|km|quilometragem|c[aâ]mbio|motor|donos?|documenta[cç][aã]o|revis[oõ]es?|pre[cç]o|valor|fipe|itens|opcionais|condi[cç][oõ]es?|contato|telefone";
  const field = (label: string) =>
    source.match(
      new RegExp(
        `\\b${label}\\s*[:=-]\\s*(.+?)(?=\\s+(?:${knownLabels})\\s*[:=-]|$)`,
        "i",
      ),
    )?.[1]?.trim();
  const ano = field("ano") ||
    source.match(/\b(?:19|20)\d{2}(?:\s*[/.-]\s*(?:19|20)?\d{2})?\b/)?.[0];
  const quilometragem = field("(?:km|quilometragem)") ||
    source.match(/\b\d{1,3}(?:[.\s]\d{3})*\s*(?:mil\s*)?km\b/i)?.[0];
  const cambio = field("c[aâ]mbio") ||
    source.match(/\b(?:automatic[oa]|manual|cvt)\b/i)?.[0];
  const preco = field("(?:pre[cç]o|valor)") ||
    source.match(/\bR\$\s*[\d.]+(?:,\d{2})?\b/i)?.[0];
  const fipe = field("fipe");
  const contato = field("(?:contato|telefone)") ||
    source.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/)?.[0];
  const motor = field("motor") ||
    source.match(/\b\d[.,]\d\s*(?:turbo|flex|diesel|gasolina)?\b/i)?.[0];
  const versao = field("vers[aã]o");
  const donos = field("donos?");
  const documentacao = field("documenta[cç][aã]o");
  const revisoes = field("revis[oõ]es?");
  const opcionais = field("(?:itens|opcionais)");
  const condicoesRaw = field("condi[cç][oõ]es?") ||
    source.match(
      /\b(?:aceita\s+troca|financia(?:mento)?(?:\s+em\s+até\s+\d+x)?|entrada\s+de\s+[^,;.]+)/i,
    )?.[0];
  let titulo = field("modelo");
  if (!titulo) {
    titulo = source.split(
      new RegExp(
        `\\s+(?=(?:${knownLabels})\\s*[:=-]|(?:19|20)\\d{2}\\b|R\\$\\s*\\d)`,
        "i",
      ),
    )[0]
      ?.replace(/^(?:modelo\s*[:=-]\s*)/i, "")
      .trim();
    if (titulo === source || /^\d/.test(titulo || "")) titulo = undefined;
  }
  return {
    ...(titulo ? { titulo: titulo.slice(0, 100) } : {}),
    ...(versao ? { versao } : {}),
    ...(ano ? { ano } : {}),
    ...(quilometragem ? { quilometragem } : {}),
    ...(cambio ? { cambio } : {}),
    ...(motor ? { motor } : {}),
    ...(donos ? { donos } : {}),
    ...(preco ? { preco } : {}),
    ...(fipe ? { fipe } : {}),
    ...(documentacao ? { documentacao } : {}),
    ...(revisoes ? { revisoes } : {}),
    ...(opcionais
      ? { opcionais: opcionais.split(/\s*(?:,|;)\s*/).filter(Boolean) }
      : {}),
    ...(condicoesRaw
      ? {
        condicoes: condicoesRaw.split(/\s*(?:,|;|\be\b)\s*/i).filter(Boolean),
      }
      : {}),
    ...(contato ? { contato } : {}),
  };
}

export function hasVehicleCarouselData(text: string): boolean {
  const value = normalize(text);
  return /\b(modelo|ano|km|quilometragem|cambio|motor|preco|valor|fipe|documentacao|itens|opcionais|condicoes?|contato|telefone)\b/
    .test(value) ||
    /\b(?:19|20)\d{2}\b|\bR\$\s*\d|\b\d+\s*(?:mil\s*)?km\b/i.test(text);
}

export function buildVehicleCarouselContentPrompt(input: {
  data: VehicleCarouselData;
  photos: VehicleCarouselPhoto[];
}): string {
  const facts = JSON.stringify(input.data);
  const views = input.photos.map((photo, index) =>
    `${index + 1}: ${photo.view || "Veículo"}`
  ).join("\n");
  const total = input.photos.length + 1;
  return `Crie o conteúdo de um carrossel premium de veículo com EXATAMENTE ${total} slides: 1 cover, ${
    Math.max(0, input.photos.length - 1)
  } content e 1 cta.
Use SOMENTE os fatos no JSON abaixo. Campo ausente não pode aparecer nem ser inferido.
Dados informados: ${facts}
Fotos, em ordem:
${views}
A cover usa a foto 1 e deve conter somente modelo, versão, ano e preço informados.
Cada content corresponde às fotos 2 em diante: título curto ligado ao tipo visual e 2–3 linhas apenas com fatos informados relacionados ao que aparece. Não atribua opcional a uma foto sem relação.
A cta deve conter apenas FIPE com mês, condições e contato informados; ctaLabel será "CHAMAR NO WHATSAPP".
Pode transformar apenas estes fatos em benefícios diretos: automático = conforto no trânsito; IPVA pago = sem gasto desse imposto agora; revisões em dia = manutenção informada; espaço interno apenas se o modelo for explicitamente uma minivan.
PROIBIDO inventar ou usar: impecável, zero defeitos, estado de zero, único dono (salvo se informado), imperdível, garantia (salvo se informada), conservação, urgência, avaliação ou depoimento.
Sem emojis nos slides. A legenda segue as mesmas regras e só pode usar esses fatos.`;
}

const UNSUPPORTED_VEHICLE_CLAIMS = [
  "impecavel",
  "zero defeitos",
  "estado de zero",
  "imperdivel",
  "unico no mercado",
  "melhor preco",
];

export function isGeneratedVehicleCopySafe(
  text: string,
  data: VehicleCarouselData,
): boolean {
  const copy = normalize(text);
  if (UNSUPPORTED_VEHICLE_CLAIMS.some((claim) => copy.includes(claim))) {
    return false;
  }
  const facts = normalize(JSON.stringify(data));
  if (copy.includes("unico dono") && !facts.includes("unico dono")) return false;
  if (copy.includes("garantia") && !facts.includes("garantia")) return false;
  const optionalClaims = [
    "bancos em couro",
    "teto solar",
    "sensor de estacionamento",
    "camera de re",
    "central multimidia",
    "ipva pago",
    "revisoes em dia",
  ];
  if (optionalClaims.some((claim) =>
    copy.includes(claim) && !facts.includes(claim)
  )) return false;

  const factValues = Object.values(data).flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : []
  ).map((value) => normalize(String(value))).filter(Boolean);
  const titleWords = normalize(data.titulo || "").split(/\s+/)
    .filter((word) => word.length >= 3);
  const structural = [
    "frente",
    "lateral",
    "traseira",
    "3/4",
    "interior",
    "painel",
    "bancos",
    "porta-malas",
    "motor",
    "rodas",
    "veiculo",
    "fale com a gente",
    "chamar no whatsapp",
  ];
  const grounded = [...factValues, ...titleWords, ...structural];
  const claims = copy.split(/[\n.!?]+/).map((part) =>
    part.replace(/^[•\-–—\s]+/, "").trim()
  ).filter(Boolean);
  return claims.every((claim) =>
    grounded.some((fact) => fact && claim.includes(fact))
  );
}

function values(value: unknown): string[] {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function relatedFact(
  view: VehiclePhotoView,
  data: VehicleCarouselData,
): string | undefined {
  const options = values(data.opcionais);
  const candidates: Record<VehiclePhotoView, RegExp> = {
    Frente: /\b(farol|grade|dianteir)/i,
    Lateral: /\b(lateral|porta|rack|teto)\b/i,
    Traseira: /\b(lanterna|traseir|sensor|camera)\b/i,
    "3/4": /\b(roda|farol|sensor)\b/i,
    Interior: /\b(interior|couro|banco|ar\s+digital|multimidia)\b/i,
    Painel: /\b(painel|ar\s+digital|multimidia|piloto|computador)\b/i,
    Bancos: /\b(banco|couro|tecido)\b/i,
    "Porta-malas": /\b(porta[- ]?malas|bagageiro)\b/i,
    Motor: /\b(motor|turbo|flex|diesel)\b/i,
    Rodas: /\b(roda|pneu|aro)\b/i,
    "Veículo": /$a/,
  };
  if (view === "Motor" && data.motor) return data.motor;
  return options.find((option) => candidates[view].test(option));
}

export function vehiclePhotoCaption(
  view: VehiclePhotoView,
  data: VehicleCarouselData,
): string {
  const fact = relatedFact(view, data);
  const caption = fact ? `${view} • ${fact}` : view;
  return caption.length <= 40 ? caption : `${caption.slice(0, 39).trimEnd()}…`;
}

export function buildVehicleCarouselSlides(input: {
  photos: VehicleCarouselPhoto[];
  data: VehicleCarouselData;
  generated?: GeneratedCarouselContent | null;
}): VehicleCarouselSlide[] {
  const photos = input.photos.slice(0, VEHICLE_CAROUSEL_MAX_PHOTOS);
  const generated = input.generated?.slides ?? [];
  const safeGenerated = (type: VehicleCarouselSlide["type"], index: number) => {
    const candidate = generated.filter((slide) => slide.type === type)[index];
    const text = `${candidate?.title || ""}\n${candidate?.body || ""}`;
    return candidate && isGeneratedVehicleCopySafe(text, input.data)
      ? candidate
      : null;
  };
  const coverGenerated = safeGenerated("cover", 0);
  const slides: VehicleCarouselSlide[] = [{
    type: "cover",
    photo_url: photos[0]?.url,
    photo_box: photos[0]?.box,
    title: coverGenerated?.title ||
      [input.data.titulo, input.data.versao, input.data.ano].filter(Boolean)
        .join(" • "),
    body: coverGenerated?.body || input.data.preco,
    reference: input.data.fipe
      ? `FIPE ${input.data.fipe}${
        input.data.fipe_mes ? ` (${input.data.fipe_mes})` : ""
      }`
      : undefined,
    number: 1,
  }];
  photos.slice(1).forEach((photo, index) => {
    const candidate = safeGenerated("content", index);
    const related = relatedFact(photo.view || "Veículo", input.data);
    slides.push({
      type: "content",
      photo_url: photo.url,
      photo_box: photo.box,
      title: candidate?.title ||
        vehiclePhotoCaption(photo.view || "Veículo", input.data),
      body: candidate?.body || related,
      number: slides.length + 1,
    });
  });
  const ctaGenerated = safeGenerated("cta", 0);
  const ctaFacts = [
    input.data.fipe
      ? `FIPE ${input.data.fipe}${
        input.data.fipe_mes ? ` (${input.data.fipe_mes})` : ""
      }`
      : undefined,
    ...values(input.data.condicoes),
    input.data.contato,
  ].filter(Boolean);
  slides.push({
    type: "cta",
    title: ctaGenerated?.title || "Fale com a gente",
    body: ctaGenerated?.body || ctaFacts.join("\n"),
    number: slides.length + 1,
  });
  return slides;
}

export function vehicleCarouselDimensions(format: VehicleCarouselFormat) {
  return {
    width: 1080,
    height: format === "square" ? 1080 : 1350,
  };
}

export function vehicleCarouselLayout(format: VehicleCarouselFormat) {
  const size = vehicleCarouselDimensions(format);
  const stripHeight = Math.floor(size.height * VEHICLE_CAROUSEL_STRIP_RATIO);
  return {
    ...size,
    stripHeight,
    photoHeight: size.height - stripHeight,
    fontSize: format === "square" ? 28 : 32,
  };
}
