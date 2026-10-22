/** FIX-VEIC-3 B2 — anúncio de veículo sempre com foto da biblioteca, nunca gerar_imagem. */

export function vehiclePhotoAdMediaId(agentState: {
  pending_vehicle_identification?: { media_ids?: string[] } | null;
  last_media_interaction?: { media_id?: string } | null;
} | null | undefined): string {
  const pending = agentState?.pending_vehicle_identification;
  return String(
    pending?.media_ids?.[0] ||
      agentState?.last_media_interaction?.media_id ||
      "",
  ).trim();
}

export function blockGerarImagemForVehiclePhotoFlow(agentState: {
  pending_vehicle_identification?: { media_ids?: string[] } | null;
} | null | undefined): boolean {
  return Boolean(vehiclePhotoAdMediaId(agentState));
}
