import { ownerPhoneVariants } from "./owner-phone.ts";
import type { GestaoAuthContext } from "./gestao-auth-phone.ts";
import { isGestaoAuthorizedPhone } from "./gestao-auth-phone.ts";

export type GestaoParceiroPhoneRow = {
  id: string;
  user_id: string;
  nome: string;
  whatsapp_e164: string | null;
  ativo: boolean;
};

export function parceiroMatchesPhone(
  parceiro: GestaoParceiroPhoneRow,
  fromNumber: string,
): boolean {
  const phone = String(parceiro.whatsapp_e164 ?? "").trim();
  if (!phone || !parceiro.ativo) return false;
  const variants = new Set(ownerPhoneVariants(fromNumber));
  for (const v of ownerPhoneVariants(phone)) {
    if (variants.has(v)) return true;
  }
  return false;
}

/** Dono/gestor sempre ganham prioridade sobre fluxo de parceiro. */
export function deveIgnorarFluxoParceiro(
  fromNumber: string,
  auth: GestaoAuthContext,
  fromIsOwner: boolean,
): boolean {
  if (fromIsOwner) return true;
  if (isGestaoAuthorizedPhone(fromNumber, auth)) return true;
  return false;
}
