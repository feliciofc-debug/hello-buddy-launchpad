import { isRecentMediaContext } from "./anuncio-media-context.ts";
import type { VehicleBatchFlowState } from "./vehicle-carousel.ts";

export const MARKETING_VEHICLE_PHOTO_TTL_MS = 10 * 60 * 1000;

export type PendingMarketingVehiclePhoto = {
  created_at: string;
  source: string;
};

const DOCUMENT_GATE_NEGATIVE_RE =
  /^n[aã]o\s+[eé]\s+documento(?:\s|$|[.!?])/i;

export function isDocumentGateNegativeReply(text: string): boolean {
  return DOCUMENT_GATE_NEGATIVE_RE.test(String(text || "").trim());
}

/** Legenda usada para roteamento de foto do dono (lote veículo, vertical, etc.). */
export function ownerPhotoRoutingCaption(
  userText: string,
  options: {
    liberatedFromDocumentGate?: boolean;
    expectsVehiclePhoto?: boolean;
  } = {},
): string {
  if (options.liberatedFromDocumentGate || options.expectsVehiclePhoto) {
    return "";
  }
  const trimmed = String(userText || "").trim();
  if (isDocumentGateNegativeReply(trimmed)) return "";
  return trimmed;
}

export function jarvisMenuSetsVehiclePhotoExpectation(menuId: string): boolean {
  const raw = String(menuId || "").trim();
  const match = raw.match(/^jarvis_menu:(grupo|lista|item):(.+)$/i);
  if (!match) return false;
  const kind = match[1].toLowerCase();
  const id = match[2];
  if (kind === "grupo" && id === "marketing") return true;
  if (kind === "lista" && (id === "marketing" || id.startsWith("marketing:"))) {
    return true;
  }
  if (kind === "item") {
    return new Set([
      "gerar-arte",
      "publicar-midia",
      "gerar-publicar",
      "agendar-post",
      "marketing-carrossel",
    ]).has(id);
  }
  return false;
}

export function ownerExpectsMarketingVehiclePhoto(
  state: VehicleBatchFlowState | null | undefined,
  nowMs = Date.now(),
): boolean {
  const pending = state?.pending_marketing_vehicle_photo as
    | PendingMarketingVehiclePhoto
    | null
    | undefined;
  return isRecentMediaContext(
    pending,
    nowMs,
    MARKETING_VEHICLE_PHOTO_TTL_MS,
  );
}

/** Marketing/anúncio: só `possivel_documento` vira foto de carro; nunca pula /detectar. */
export function ownerTreatPossibleDocumentAsVehiclePhoto(
  state: VehicleBatchFlowState | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (ownerExpectsMarketingVehiclePhoto(state, nowMs)) return true;
  const pendingPhoto = state?.pending_anuncio_photo as
    | { stage?: string; created_at?: string }
    | null
    | undefined;
  return pendingPhoto?.stage === "awaiting_photo" &&
    isRecentMediaContext(pendingPhoto, nowMs, MARKETING_VEHICLE_PHOTO_TTL_MS);
}

/** Resposta genérica de mídia salva sem bloco "ID da mídia". */
export function respostaMidiaSalvaSemCodigos(
  salvos: Array<{ tipo: string }>,
  descricaoVisual?: string,
): string {
  const tipos = salvos.reduce((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const partes = [
    tipos.foto ? `${tipos.foto} foto${tipos.foto > 1 ? "s" : ""}` : "",
    tipos.video ? `${tipos.video} vídeo${tipos.video > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(", ");
  if (descricaoVisual?.trim()) {
    return `Salvei ${partes || "a mídia"} na biblioteca /midias. Estou vendo uma imagem que mostra: ${descricaoVisual.trim()}\n\nO que você quer que eu faça com ela? Posso preparar a legenda e o post para as redes.`;
  }
  return `Salvei ${partes || "a mídia"} na biblioteca /midias. O que você quer que eu faça com ela?`;
}
