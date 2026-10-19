import { ML_API_BASE, mlClientId, mlClientSecret } from "./ml-config.ts";
import { getMlAccessTokenForUser } from "./ml-token.ts";

type AdminSb = Parameters<typeof getMlAccessTokenForUser>[0];

let appTokenCache: { token: string; exp: number } | null = null;

async function getMlAppAccessTokenForZipLookup(): Promise<string> {
  if (appTokenCache && appTokenCache.exp > Date.now() + 60_000) {
    return appTokenCache.token;
  }
  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: mlClientId(),
      client_secret: mlClientSecret(),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body?.message ?? body?.error ?? "ml_app_token_failed"));
  const token = String(body.access_token ?? "");
  const expiresIn = Number(body.expires_in) || 3600;
  appTokenCache = { token, exp: Date.now() + expiresIn * 1000 };
  return token;
}

/** Token para GET zip_codes — conta do lojista se conectada, senão app credentials. */
export async function getMlZipLookupAccessToken(sb: AdminSb, userId: string): Promise<string> {
  try {
    const { accessToken } = await getMlAccessTokenForUser(sb, userId);
    return accessToken;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "ml_not_connected" || msg === "ml_needs_reauth") {
      return await getMlAppAccessTokenForZipLookup();
    }
    throw e;
  }
}
