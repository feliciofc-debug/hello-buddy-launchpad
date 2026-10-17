export const ML_OAUTH_REDIRECT_URI =
  "https://api.amzofertas.com.br/functions/v1/ml-oauth-callback";

export const ML_NOTIFICATIONS_URL =
  "https://api.amzofertas.com.br/functions/v1/ml-notifications";

export const ML_OAUTH_AUTHORIZE_URL =
  "https://auth.mercadolivre.com.br/authorization";

export const ML_API_BASE = "https://api.mercadolibre.com";

export const ML_SITE_ID = "MLB";

export const ML_DEFAULT_CAR_CATEGORY = "MLB1744";

export const ML_LISTING_TYPE_SILVER = "silver";

export const ML_MAX_PICTURES_DEFAULT = 25;

/** OAuth state válido por 10 minutos (redirect ML). */
export const ML_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function mlAppUrl(): string {
  return Deno.env.get("APP_URL") || "https://amzofertas.com.br";
}

export function mlClientId(): string {
  const id = Deno.env.get("ML_CLIENT_ID");
  if (!id) throw new Error("ML_CLIENT_ID não configurado");
  return id;
}

export function mlClientSecret(): string {
  const s = Deno.env.get("ML_CLIENT_SECRET");
  if (!s) throw new Error("ML_CLIENT_SECRET não configurado");
  return s;
}
