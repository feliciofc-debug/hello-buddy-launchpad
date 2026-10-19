import { resolveTenantOwner } from "./amz-context.ts";

/** Telefone Jarvis/WhatsApp oficial da loja (DDD + número, só dígitos). */
export async function buildOlxSellerPhone(
  sb: unknown,
  userId: string,
): Promise<string | null> {
  const owner = await resolveTenantOwner(sb as never, userId);
  const phone = String(owner.phone ?? "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return null;
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  if (local.length < 10 || local.length > 11) return null;
  return local;
}
