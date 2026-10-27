import type { VehicleIdentification } from "./vehicle-identification.ts";
import {
  validPendingVehicleIdentification,
  VEHICLE_IDENTIFICATION_TTL_MS,
} from "./vehicle-identification.ts";
import type { VehiclePhotoActionContext } from "./vehicle-photo-action-context.ts";
import { validVehiclePhotoActionContext } from "./vehicle-photo-action-context.ts";

export const ANUNCIO_MEDIA_TTL_MS = VEHICLE_IDENTIFICATION_TTL_MS;

export type TimestampedMediaRef = {
  media_id?: string;
  created_at?: string;
  at?: string;
};

export function mediaContextAgeMs(
  value: { created_at?: string; at?: string } | null | undefined,
  nowMs = Date.now(),
): number {
  const timestamp = Date.parse(String(value?.created_at || value?.at || ""));
  if (!Number.isFinite(timestamp) || timestamp > nowMs) {
    return Number.POSITIVE_INFINITY;
  }
  return nowMs - timestamp;
}

export function isRecentMediaContext(
  value: { created_at?: string; at?: string } | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = ANUNCIO_MEDIA_TTL_MS,
): boolean {
  const age = mediaContextAgeMs(value, nowMs);
  return Number.isFinite(age) && age <= maxAgeMs;
}

export function staleVehicleMediaContextPatch(
  agentState: Record<string, unknown> | null | undefined,
  nowMs = Date.now(),
): Record<string, null> {
  const patch: Record<string, null> = {};
  const pending = agentState?.pending_vehicle_identification as
    | { created_at?: string }
    | null
    | undefined;
  if (pending && !validPendingVehicleIdentification(pending, nowMs)) {
    patch.pending_vehicle_identification = null;
  }
  const saved = agentState?.last_vehicle_photo_context as
    | { created_at?: string }
    | null
    | undefined;
  if (saved && !validPendingVehicleIdentification(saved, nowMs)) {
    patch.last_vehicle_photo_context = null;
  }
  const lastInteraction = agentState?.last_media_interaction as
    | TimestampedMediaRef
    | null
    | undefined;
  if (lastInteraction && !isRecentMediaContext(lastInteraction, nowMs)) {
    patch.last_media_interaction = null;
  }
  const single = agentState?.pending_single_photo as
    | TimestampedMediaRef
    | null
    | undefined;
  if (single && !isRecentMediaContext(single, nowMs)) {
    patch.pending_single_photo = null;
  }
  return patch;
}

type AnuncioMediaAgentState = Record<string, unknown>;

function readState(
  state: AnuncioMediaAgentState | null | undefined,
): AnuncioMediaAgentState {
  return state ?? {};
}

export function resolveAnuncioMediaId(input: {
  agentState?: AnuncioMediaAgentState | null;
  explicitMediaId?: string | null;
  nowMs?: number;
}): string {
  const state = readState(input.agentState);
  const nowMs = input.nowMs ?? Date.now();
  const explicit = String(input.explicitMediaId || "").trim();
  if (explicit) return explicit;

  const pendingCliente = state.pending_anuncio_cliente as {
    media_id?: string;
    created_at?: string;
    args?: Record<string, unknown>;
  } | null | undefined;
  const pendingPhoto = state.pending_anuncio_photo as {
    media_id?: string;
    created_at?: string;
    args?: Record<string, unknown>;
  } | null | undefined;
  const pendingStyles = state.pending_anuncio_styles as {
    source_media_id?: string;
    created_at?: string;
  } | null | undefined;

  const fromArgs = String(
    pendingCliente?.args?._anuncio_media_id ||
      pendingPhoto?.args?._anuncio_media_id ||
      "",
  ).trim();
  if (fromArgs) return fromArgs;

  const clienteMedia = String(pendingCliente?.media_id || "").trim();
  if (clienteMedia && isRecentMediaContext(pendingCliente, nowMs)) {
    return clienteMedia;
  }

  const pendingPhotoMedia = String(pendingPhoto?.media_id || "").trim();
  if (pendingPhotoMedia && isRecentMediaContext(pendingPhoto, nowMs)) {
    return pendingPhotoMedia;
  }

  const stylesMedia = String(pendingStyles?.source_media_id || "").trim();
  if (stylesMedia && isRecentMediaContext(pendingStyles, nowMs)) {
    return stylesMedia;
  }

  const pending = state.pending_vehicle_identification as
    | VehiclePhotoActionContext
    | null
    | undefined;
  if (pending && validPendingVehicleIdentification(pending, nowMs)) {
    const id = String(pending.media_ids?.[0] || "").trim();
    if (id) return id;
  }

  const singlePhoto = state.pending_single_photo as TimestampedMediaRef | null;
  const single = String(singlePhoto?.media_id || "").trim();
  if (single && isRecentMediaContext(singlePhoto, nowMs)) {
    return single;
  }

  const lastInteraction = state.last_media_interaction as TimestampedMediaRef | null;
  const last = String(lastInteraction?.media_id || "").trim();
  if (last && isRecentMediaContext(lastInteraction, nowMs)) {
    return last;
  }

  return "";
}

export function vehicleIdentificationBundleForMedia(input: {
  agentState?: Record<string, unknown> | null;
  mediaId: string;
  nowMs?: number;
}): {
  identification: VehicleIdentification;
  confirmed?: boolean;
  confirmed_title?: string;
  data?: Record<string, unknown>;
  media_ids: string[];
} | null {
  const mediaId = String(input.mediaId || "").trim();
  if (!mediaId) return null;
  const nowMs = input.nowMs ?? Date.now();
  const state = readState(input.agentState);
  const pending = state.pending_vehicle_identification as
    | VehiclePhotoActionContext
    | null
    | undefined;
  if (
    pending &&
    validPendingVehicleIdentification(pending, nowMs) &&
    pending.media_ids?.includes(mediaId)
  ) {
    return {
      identification: pending.identification,
      confirmed: pending.confirmed,
      confirmed_title: pending.confirmed_title,
      data: pending.data as Record<string, unknown> | undefined,
      media_ids: pending.media_ids,
    };
  }
  const saved = state.last_vehicle_photo_context as
    | VehiclePhotoActionContext
    | null
    | undefined;
  if (
    saved &&
    validPendingVehicleIdentification(saved, nowMs) &&
    saved.media_ids?.includes(mediaId)
  ) {
    return {
      identification: saved.identification,
      confirmed: saved.confirmed,
      confirmed_title: saved.confirmed_title,
      data: saved.data as Record<string, unknown> | undefined,
      media_ids: saved.media_ids,
    };
  }
  const router = state.vertical_router as {
    media_routes?: Record<string, {
      vehicle_identification?: VehicleIdentification;
      vehicle_media_ids?: string[];
      confirmed?: boolean;
      confirmed_product_title?: string;
    }>;
  } | null | undefined;
  const route = router?.media_routes?.[mediaId];
  if (route?.vehicle_identification) {
    return {
      identification: route.vehicle_identification,
      confirmed: route.confirmed,
      confirmed_title: route.confirmed_product_title,
      media_ids: route.vehicle_media_ids?.length
        ? route.vehicle_media_ids
        : [mediaId],
    };
  }
  return null;
}

export function anuncioPhotoContextConflict(input: {
  agentState?: Record<string, unknown> | null;
  mediaId: string;
  nowMs?: number;
}): boolean {
  const mediaId = String(input.mediaId || "").trim();
  if (!mediaId) return false;
  const nowMs = input.nowMs ?? Date.now();
  const state = readState(input.agentState);
  const pending = state.pending_vehicle_identification as
    | VehiclePhotoActionContext
    | null
    | undefined;
  if (
    pending &&
    validPendingVehicleIdentification(pending, nowMs) &&
    pending.media_ids?.length &&
    !pending.media_ids.includes(mediaId)
  ) {
    return true;
  }
  const saved = state.last_vehicle_photo_context as
    | VehiclePhotoActionContext
    | null
    | undefined;
  if (
    saved &&
    validPendingVehicleIdentification(saved, nowMs) &&
    saved.media_ids?.length &&
    !saved.media_ids.includes(mediaId)
  ) {
    return true;
  }
  return false;
}

export function freshVehiclePhotoActionContext(
  value: VehiclePhotoActionContext | null | undefined,
  nowMs = Date.now(),
): VehiclePhotoActionContext | null {
  if (!validVehiclePhotoActionContext(value)) return null;
  if (!validPendingVehicleIdentification(value, nowMs)) return null;
  return value;
}

export function bindAnuncioMediaToArgs(
  args: Record<string, unknown>,
  mediaId: string,
): Record<string, unknown> {
  const id = String(mediaId || "").trim();
  if (!id) return args;
  return { ...args, _anuncio_media_id: id };
}

export function vehiclePhotoContextFromState(input: {
  pending?: VehiclePhotoActionContext | null;
  saved?: VehiclePhotoActionContext | null;
  explicitMediaId?: string | null;
  nowMs?: number;
}): VehiclePhotoActionContext | null {
  const nowMs = input.nowMs ?? Date.now();
  const explicitMediaId = String(input.explicitMediaId || "").trim();
  const pending = freshVehiclePhotoActionContext(input.pending, nowMs);
  const saved = freshVehiclePhotoActionContext(input.saved, nowMs);
  const base = pending || saved;
  if (!base) return null;
  if (!explicitMediaId) return base;
  if (base.media_ids.includes(explicitMediaId)) return base;
  return {
    ...base,
    media_ids: [explicitMediaId, ...base.media_ids.filter((id) =>
      id !== explicitMediaId
    )],
    created_at: new Date(nowMs).toISOString(),
  };
}
