import {
  generateGestaoContadorToken,
  GESTAO_CONTADOR_TOKEN_TTL_DAYS,
  hashGestaoContadorToken,
} from "./gestao-contador-token.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export async function mintGestaoContadorLink(
  client: Db,
  userId: string,
  competencia: string,
  siteBase: string,
): Promise<{ appUrl: string; expiresAt: string }> {
  const token = generateGestaoContadorToken();
  const token_hash = await hashGestaoContadorToken(token);
  const expires = new Date();
  expires.setDate(expires.getDate() + GESTAO_CONTADOR_TOKEN_TTL_DAYS);
  const { error } = await client.from("gestao_contador_token").insert({
    user_id: userId,
    token_hash,
    competencia,
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(error.message);
  const base = siteBase.replace(/\/$/, "");
  const path = `/contador/${token}`;
  return {
    appUrl: base ? `${base}${path}` : path,
    expiresAt: expires.toISOString(),
  };
}
