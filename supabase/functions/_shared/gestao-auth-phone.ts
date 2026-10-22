import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeOwnerPhone,
  ownerPhoneVariants,
} from "./owner-phone.ts";

export type GestaoAuthContext = {
  ownerPhone: string | null;
  ownerAltPhones: string[];
  gestores: string[];
};

export function gestaoAuthorizedVariants(ctx: GestaoAuthContext): Set<string> {
  const all = [
    ctx.ownerPhone,
    ...ctx.ownerAltPhones,
    ...ctx.gestores,
  ];
  const out = new Set<string>();
  for (const p of all) {
    for (const v of ownerPhoneVariants(p)) out.add(v);
  }
  return out;
}

export function isGestaoAuthorizedPhone(
  fromNumber: string,
  ctx: GestaoAuthContext,
): boolean {
  const variants = gestaoAuthorizedVariants(ctx);
  if (!variants.size) return false;
  for (const v of ownerPhoneVariants(fromNumber)) {
    if (variants.has(v)) return true;
  }
  return false;
}

export function maskGestaoPhone(fromNumber: string): string {
  const n = normalizeOwnerPhone(fromNumber);
  if (!n) return "****";
  return `***${n.slice(-4)}`;
}

export async function loadGestaoAuthContext(
  sb: SupabaseClient,
  userId: string,
): Promise<GestaoAuthContext> {
  const [{ data: agent }, { data: empresa }] = await Promise.all([
    sb.from("whatsapp_cloud_agent_config").select("owner_phone, owner_alt_phones")
      .eq("user_id", userId).maybeSingle(),
    sb.from("empresa_config").select("gestao_gestores_json")
      .eq("user_id", userId).maybeSingle(),
  ]);
  const gestoresRaw = empresa?.gestao_gestores_json;
  const gestores = Array.isArray(gestoresRaw)
    ? gestoresRaw.map((p) => normalizeOwnerPhone(String(p))).filter(Boolean)
    : [];
  const alts = Array.isArray(agent?.owner_alt_phones)
    ? agent!.owner_alt_phones.map((p) => normalizeOwnerPhone(String(p))).filter(Boolean)
    : [];
  return {
    ownerPhone: agent?.owner_phone
      ? normalizeOwnerPhone(String(agent.owner_phone))
      : null,
    ownerAltPhones: alts,
    gestores,
  };
}
