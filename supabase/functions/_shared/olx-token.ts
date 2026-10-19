import { decryptOlxSecret } from "./olx-token-crypto.ts";

export async function getOlxAccessTokenForUser(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("olx_connection")
    .select("access_token_enc")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.access_token_enc) {
    throw new Error("Conecte sua conta OLX em Configurações → Integrações.");
  }
  return decryptOlxSecret(data.access_token_enc);
}
