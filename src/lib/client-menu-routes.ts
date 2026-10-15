import {
  isPremiumVehicleRetailBusiness,
  PREMIUM_VEHICLE_RETAIL_SEGMENT,
} from "../../supabase/functions/_shared/company-service-profile.ts";

export const CLIENT_MENU_ROUTES: Record<string, string> = {
  "/dashboard": "dashboard",
  "/meus-produtos": "produtos",
  "/veiculos": "veiculos",
  "/veiculos/financiamento": "veiculos",
  "/midias": "midias",
  "/ia-marketing": "ia-marketing",
  "/redes-sociais": "redes-sociais",
  "/whatsapp-painel": "whatsapp",
  "/configuracoes": "configuracoes",
  "/pj/listas-contatos": "whatsapp",
  "/pj/whatsapp-automacao": "whatsapp",
  "/whatsapp": "whatsapp",
  "/configuracoes-whatsapp": "whatsapp",
  "/configuracoes/redes-sociais": "redes-sociais",
  "/ia-conversas": "ia-marketing",
  "/campanhas-prospeccao": "whatsapp",
  "/prospects": "whatsapp",
  "/leads-funil": "whatsapp",
  "/vendedores": "configuracoes",
  "/biblioteca": "ia-marketing",
  "/analytics": "dashboard",
  "/google-ads": "configuracoes",
  "/anuncios-meta": "configuracoes",
  "/lomadee": "produtos",
  "/marketplace": "produtos",
  "/produtos": "produtos",
};

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  revenda_veiculos: "Revenda de veículos",
};

export function clientTypeLabel(clientType: string): string {
  return CLIENT_TYPE_LABELS[clientType] || clientType;
}

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

export function menusForBusinessSegment(
  menus: string[],
  clientType: string | null | undefined,
  segment: string | null | undefined,
  businessText: string | null | undefined,
): string[] {
  const vehicleInventory = usesVehicleInventoryMenu(
    clientType,
    segment,
    businessText,
  );
  const sourceMenu = vehicleInventory ? "produtos" : "veiculos";
  const targetMenu = vehicleInventory ? "veiculos" : "produtos";
  const resolved = menus.map((menu) =>
    menu === sourceMenu ? targetMenu : menu
  );
  return [...new Set(resolved)];
}
