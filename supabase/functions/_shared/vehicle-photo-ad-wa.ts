/** FIX-VEIC-3 B2 — anúncio de veículo sempre com foto da biblioteca, nunca gerar_imagem. */

import { resolveAnuncioMediaId } from "./anuncio-media-context.ts";

export function vehiclePhotoAdMediaId(
  agentState: {
    pending_vehicle_identification?: { media_ids?: string[]; created_at?: string } | null;
    last_media_interaction?: { media_id?: string; at?: string } | null;
    pending_single_photo?: { media_id?: string; created_at?: string } | null;
    pending_anuncio_cliente?: { media_id?: string; created_at?: string; args?: Record<string, unknown> } | null;
    pending_anuncio_photo?: { media_id?: string; created_at?: string; args?: Record<string, unknown> } | null;
    pending_anuncio_styles?: { source_media_id?: string; created_at?: string } | null;
    last_vehicle_photo_context?: { media_ids?: string[]; created_at?: string } | null;
  } | null | undefined,
  explicitMediaId?: string | null,
): string {
  return resolveAnuncioMediaId({ agentState, explicitMediaId });
}

export function blockGerarImagemForVehiclePhotoFlow(agentState: {
  pending_vehicle_identification?: { media_ids?: string[] } | null;
} | null | undefined): boolean {
  return Boolean(vehiclePhotoAdMediaId(agentState));
}
