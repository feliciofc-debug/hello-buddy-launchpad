import type { AnuncioPhotoPreference } from "./anuncio-style.ts";

export const VEHICLE_CAROUSEL_TTL_MS = 30 * 60 * 1000;
export const VEHICLE_PHOTO_BATCH_TTL_MS = 3 * 60 * 1000;
export const VEHICLE_CAROUSEL_MAX_PHOTOS = 8;
export const VEHICLE_CAROUSEL_MIN_PHOTOS = 3;
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
  ano?: string;
  preco?: string;
  fipe?: string;
  fipe_mes?: string;
  quilometragem?: string;
  cambio?: string;
  motor?: string;
  documentacao?: string;
  condicoes?: string[];
  contato?: string;
  opcionais?: string[];
};

export type VehicleCarouselSlide = {
  type: "cover" | "content" | "cta";
  photo_url: string;
  photo_box?: [number, number, number, number] | null;
  title: string;
  body?: string;
  reference?: string;
  number: number;
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
    body:
      "Como quer as fotos? Melhorar só muda fundo e luz; o veículo fica igual.",
    buttons: [
      {
        id: "vehicle_carousel:photo:melhorada",
        title: "Melhorar fundo e luz",
      },
      {
        id: "vehicle_carousel:photo:original",
        title: "Usar foto original",
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
    "modelo|ano|km|quilometragem|c[aâ]mbio|motor|pre[cç]o|valor|fipe|documenta[cç][aã]o|itens|opcionais|condi[cç][oõ]es?|contato|telefone";
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
  const documentacao = field("documenta[cç][aã]o");
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
    ...(ano ? { ano } : {}),
    ...(quilometragem ? { quilometragem } : {}),
    ...(cambio ? { cambio } : {}),
    ...(motor ? { motor } : {}),
    ...(preco ? { preco } : {}),
    ...(fipe ? { fipe } : {}),
    ...(documentacao ? { documentacao } : {}),
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
}): VehicleCarouselSlide[] {
  const total = Math.min(VEHICLE_CAROUSEL_MAX_PHOTOS, input.photos.length);
  return input.photos.slice(0, total).map((photo, index) => {
    if (index === 0) {
      return {
        type: "cover",
        photo_url: photo.url,
        photo_box: photo.box,
        title: [input.data.titulo, input.data.ano].filter(Boolean).join(" • "),
        body: input.data.preco,
        reference: input.data.fipe
          ? `FIPE ${input.data.fipe}${
            input.data.fipe_mes ? ` (${input.data.fipe_mes})` : ""
          }`
          : undefined,
        number: index + 1,
      };
    }
    if (index === total - 1) {
      const facts = [
        input.data.quilometragem,
        input.data.cambio,
        input.data.documentacao,
        ...values(input.data.condicoes),
      ].filter(Boolean).slice(0, 4);
      return {
        type: "cta",
        photo_url: photo.url,
        photo_box: photo.box,
        title: facts.join(" • "),
        body: input.data.contato,
        number: index + 1,
      };
    }
    return {
      type: "content",
      photo_url: photo.url,
      photo_box: photo.box,
      title: vehiclePhotoCaption(photo.view || "Veículo", input.data),
      number: index + 1,
    };
  });
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
