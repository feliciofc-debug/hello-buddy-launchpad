export const VEHICLE_DEALER_TENANT_TYPE = "revenda_veiculos";

export function isBusinessTenantType(type: string | null | undefined): boolean {
  return type === "empresa" || type === VEHICLE_DEALER_TENANT_TYPE;
}

export function businessTenantHomePath(
  _type: string | null | undefined,
): "/dashboard" {
  return "/dashboard";
}
