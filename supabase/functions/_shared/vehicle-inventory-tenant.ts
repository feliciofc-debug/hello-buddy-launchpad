import {
  isPremiumVehicleRetailBusiness,
  PREMIUM_VEHICLE_RETAIL_SEGMENT,
} from "./company-service-profile.ts";

/** Mesma regra do menu Estoque no front — só em _shared (edge não importa src/). */
export function usesVehicleInventoryMenu(
  clientType: string | null | undefined,
  segment: string | null | undefined,
  businessText: string | null | undefined,
): boolean {
  if (clientType === "revenda_veiculos") return true;
  if (segment === PREMIUM_VEHICLE_RETAIL_SEGMENT) return true;
  return segment === "automotivo" &&
    isPremiumVehicleRetailBusiness(businessText || "");
}

export type TenantVehicleStockGate = {
  usesVehicleStock: boolean;
  segmento: string | null;
  vitrine_veiculos_demo: boolean;
  clientType: string | null;
  sobre_negocio: string | null;
};

export async function loadTenantVehicleStockGate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
): Promise<TenantVehicleStockGate> {
  const [{ data: profile }, { data: config }] = await Promise.all([
    sb.from("profiles").select("tipo").eq("id", userId).maybeSingle(),
    sb.from("empresa_config").select(
      "segmento, sobre_negocio, vitrine_veiculos_demo",
    ).eq("user_id", userId).maybeSingle(),
  ]);
  const segmento = String(config?.segmento ?? "").trim() || null;
  const sobre_negocio = String(config?.sobre_negocio ?? "").trim() || null;
  const vitrine_veiculos_demo = config?.vitrine_veiculos_demo === true;
  const clientType = String(profile?.tipo ?? "").trim() || null;
  const usesMenu = usesVehicleInventoryMenu(
    clientType,
    segmento,
    sobre_negocio,
  );
  return {
    usesVehicleStock: usesMenu || vitrine_veiculos_demo,
    segmento,
    vitrine_veiculos_demo,
    clientType,
    sobre_negocio,
  };
}
