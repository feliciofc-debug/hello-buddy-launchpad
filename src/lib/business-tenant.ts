export const VEHICLE_DEALER_TENANT_TYPE = "revenda_veiculos";

export function isBusinessTenantType(type: string | null | undefined): boolean {
  return type === "empresa" || type === VEHICLE_DEALER_TENANT_TYPE;
}

export function businessTenantHomePath(
  type: string | null | undefined,
): "/dashboard" | "/veiculos" {
  return type === VEHICLE_DEALER_TENANT_TYPE ? "/veiculos" : "/dashboard";
}
