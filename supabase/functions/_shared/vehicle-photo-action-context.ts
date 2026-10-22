import type { VehicleIdentification } from "./vehicle-identification.ts";

export type VehiclePhotoActionContext = {
  identification: VehicleIdentification;
  media_ids: string[];
  target: "single_ad" | "carousel";
  confirmed?: boolean;
  confirmed_title?: string;
  awaiting_correction?: boolean;
  data?: Record<string, unknown>;
  created_at: string;
};

type MediaRouteWithIdentification = {
  route?: string;
  vehicle_identification?: VehicleIdentification;
  vehicle_media_ids?: string[];
};

export function validVehiclePhotoActionContext(
  value: VehiclePhotoActionContext | null | undefined,
): value is VehiclePhotoActionContext {
  return Boolean(
    value?.identification &&
      Array.isArray(value.media_ids) &&
      value.media_ids.some((id) => String(id || "").trim()),
  );
}

/**
 * Recupera o contexto de um botão antigo mesmo após `criar_anuncio` limpar o
 * pending. A ordem evita usar a arte gerada como foto-fonte do veículo.
 */
export function resolveVehiclePhotoActionContext(input: {
  pending?: VehiclePhotoActionContext | null;
  saved?: VehiclePhotoActionContext | null;
  lastMediaId?: string | null;
  mediaRoutes?: Record<string, MediaRouteWithIdentification> | null;
}): VehiclePhotoActionContext | null {
  if (validVehiclePhotoActionContext(input.pending)) return input.pending;
  if (validVehiclePhotoActionContext(input.saved)) return input.saved;

  const lastMediaId = String(input.lastMediaId || "").trim();
  const route = lastMediaId ? input.mediaRoutes?.[lastMediaId] : null;
  if (
    route?.route === "veiculo" &&
    route.vehicle_identification &&
    Array.isArray(route.vehicle_media_ids)
  ) {
    const recovered: VehiclePhotoActionContext = {
      identification: route.vehicle_identification,
      media_ids: route.vehicle_media_ids,
      target: "single_ad",
      created_at: new Date().toISOString(),
    };
    return validVehiclePhotoActionContext(recovered) ? recovered : null;
  }
  return null;
}

export function vehicleInteractiveMissingPhotoReply(): string {
  return "Não encontrei a foto deste veículo. Envie a imagem novamente.";
}
