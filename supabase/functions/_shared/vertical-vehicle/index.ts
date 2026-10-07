import type {
  InboundVertical,
  VerticalNamespacedState,
} from "../vertical-router.ts";
import { vehicleSingleRepeatedPhotoButtons } from "../vehicle-carousel.ts";

export const VEHICLE_VERTICAL: InboundVertical = "veiculo";

export function vehicleState(
  state: VerticalNamespacedState,
): Record<string, unknown> {
  return { ...(state.vehicle ?? {}) };
}

export function vehicleOwnsRequest(text: string): boolean {
  const normalized = String(text || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(fipe|repasse|carro|veiculo|automovel|moto|seminovo)\b/.test(
    normalized,
  );
}

export function vehicleSpecialistPrompt(): string {
  return [
    "ESPECIALISTA DE VEÍCULOS.",
    "Use somente fatos informados sobre o veículo.",
    "Ferramentas próprias: anúncio de veículo, carrossel de veículo, FIPE, lote de fotos e repasse.",
    "Nunca leia catálogo, produto geral ou estado da vertical geral.",
  ].join("\n");
}

export function vehicleSpecialistAllowsTool(toolName: string): boolean {
  return toolName !== "criar_carrossel";
}

export function vehicleSpecialistPhotoButtons() {
  return vehicleSingleRepeatedPhotoButtons();
}
