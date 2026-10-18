import { VEHICLE_DEALER_TENANT_TYPE } from "@/lib/business-tenant";

export const AMZ_AUTO_MODE_STORAGE_KEY = "amz_auto_mode";

export function readAmzAutoModePreference(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(AMZ_AUTO_MODE_STORAGE_KEY) === "1";
}

export function writeAmzAutoModePreference(active: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  if (active) {
    sessionStorage.setItem(AMZ_AUTO_MODE_STORAGE_KEY, "1");
  } else {
    sessionStorage.removeItem(AMZ_AUTO_MODE_STORAGE_KEY);
  }
}

export function clearAmzAutoModePreference(): void {
  writeAmzAutoModePreference(false);
}

export function isRevendaVeiculosProfile(
  profileTipo: string | null | undefined,
): boolean {
  return profileTipo === VEHICLE_DEALER_TENANT_TYPE;
}

/** Só sessionStorage — nunca inferido pelo tipo de perfil. */
export function isEffectiveAmzAutoMode(modePreference: boolean): boolean {
  return modePreference;
}

/** Admin ou loja revenda_veiculos pode sair do modo (e admin pode entrar). */
export function canToggleAmzAutoMode(
  profileTipo: string | null | undefined,
  isAdmin: boolean,
): boolean {
  return isAdmin || isRevendaVeiculosProfile(profileTipo);
}
