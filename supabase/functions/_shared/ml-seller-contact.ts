import { resolveTenantOwner } from "./amz-context.ts";

/** car_dealer: WhatsApp da loja (phone2) para o botão ML cair no robô AMZ. */
export async function buildMlSellerContact(
  sb: unknown,
  userId: string,
): Promise<Record<string, string> | null> {
  const owner = await resolveTenantOwner(sb as never, userId);
  const phone = String(owner.phone ?? "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return null;
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  return {
    contact: owner.name ?? "Loja",
    country_code2: "55",
    phone2: local,
    country_code: "55",
    phone: local,
  };
}
