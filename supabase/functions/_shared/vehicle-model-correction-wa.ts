import type { VehicleIdentification } from "./vehicle-identification.ts";
import { hasSpecificVehicleModel } from "./vehicle-identification.ts";
import type { FipeListItem } from "./fipe.ts";
import { rankFipeItems } from "./fipe.ts";

export const VEHICLE_MODEL_FIX_PREFIX = "vehicle_model_fix:";

export function vehicleModelFixInteractiveId(action: string): string {
  return `${VEHICLE_MODEL_FIX_PREFIX}${action}`;
}

export function parseVehicleModelFixInteractiveId(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:vehicle_model_fix:([^>]+)>>/i,
  );
  return match?.[1]?.trim() || null;
}

export function vehicleModelCorrectionQuestion(): string {
  return "Qual destes modelos combina melhor com a foto?";
}

/** Até 3 alternativas: sugestão principal + variantes plausíveis da mesma marca. */
export function vehicleModelCorrectionAlternatives(
  identification: VehicleIdentification | null,
): string[] {
  if (!identification?.marca || !identification?.modelo) return [];
  const primary = `${identification.marca} ${identification.modelo}`.trim();
  const seen = new Set<string>([primary.toLowerCase()]);
  const out: string[] = [primary];
  const hints = (identification.pistas_visuais || [])
    .map((h) => h.trim())
    .filter((h) => h.length > 2 && h.length < 40);
  for (const hint of hints) {
    if (out.length >= 3) break;
    const candidate = `${identification.marca} ${hint}`.trim();
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(candidate);
    }
  }
  return out.slice(0, 3);
}

export function vehicleModelCorrectionButtons(
  identification: VehicleIdentification | null,
) {
  const alts = vehicleModelCorrectionAlternatives(identification);
  const buttons: Array<{ id: string; title: string }> = [];
  alts.forEach((label, index) => {
    buttons.push({
      id: vehicleModelFixInteractiveId(`alt:${index}`),
      title: label.slice(0, 20),
    });
  });
  if (buttons.length < 3) {
    buttons.push({
      id: vehicleModelFixInteractiveId("other"),
      title: "Outro modelo",
    });
  }
  return {
    body: vehicleModelCorrectionQuestion(),
    buttons: buttons.slice(0, 3),
  };
}

export function vehicleModelFixAltLabel(
  identification: VehicleIdentification | null,
  index: number,
): string | null {
  return vehicleModelCorrectionAlternatives(identification)[index] ?? null;
}

const COMMON_FIPE_BRANDS = [
  "Chevrolet",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "Nissan",
  "Renault",
  "Toyota",
  "Volkswagen",
];

export function vehicleModelBrandListRows(
  brands: FipeListItem[],
): Array<{ id: string; title: string; description?: string }> {
  const ranked = rankFipeItems(brands, "");
  const picked = ranked.length
    ? ranked.slice(0, 8)
    : brands.slice(0, 8);
  const rows = picked.map((b) => ({
    id: vehicleModelFixInteractiveId(`brand:${b.code}`),
    title: b.name.slice(0, 24),
    description: b.code,
  }));
  rows.push({
    id: vehicleModelFixInteractiveId("brand:other"),
    title: "Outra marca",
    description: "",
  });
  return rows.slice(0, 10);
}

export function vehicleModelModelListRows(
  models: FipeListItem[],
  brandCode: string,
): Array<{ id: string; title: string; description?: string }> {
  const rows = models.slice(0, 9).map((m) => ({
    id: vehicleModelFixInteractiveId(`model:${brandCode}:${m.code}`),
    title: m.name.slice(0, 24),
    description: m.code,
  }));
  rows.push({
    id: vehicleModelFixInteractiveId(`model:${brandCode}:more`),
    title: "Mais modelos",
    description: "",
  });
  return rows.slice(0, 10);
}

export function parseVehicleModelFixBrandCode(action: string): string | null {
  const m = action.match(/^brand:([^:]+)$/);
  return m?.[1] ?? null;
}

export function parseVehicleModelFixModelRef(
  action: string,
): { brandCode: string; modelCode: string } | null {
  const m = action.match(/^model:([^:]+):([^:]+)$/);
  if (!m) return null;
  return { brandCode: m[1], modelCode: m[2] };
}

export function applyVehicleModelFixTitle(
  identification: VehicleIdentification,
  title: string,
): VehicleIdentification {
  const parts = title.trim().split(/\s+/);
  const marca = parts[0] || identification.marca;
  const modelo = parts.slice(1).join(" ") || identification.modelo;
  return {
    ...identification,
    marca,
    modelo,
    confianca: "alta",
  };
}

export function vehicleModelCorrectionReady(
  identification: VehicleIdentification | null,
): boolean {
  return hasSpecificVehicleModel(identification);
}
