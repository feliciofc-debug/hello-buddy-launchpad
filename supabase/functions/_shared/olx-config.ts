export const OLX_OAUTH_AUTHORIZE_URL = "https://auth.olx.com.br/oauth";
export const OLX_OAUTH_TOKEN_URL = "https://auth.olx.com.br/oauth/token";
export const OLX_BASIC_USER_INFO_URL = "https://apps.olx.com.br/oauth_api/basic_user_info";
export const OLX_AUTOUPLOAD_IMPORT_URL = "https://apps.olx.com.br/autoupload/import";

export const OLX_DEFAULT_REDIRECT_URI =
  "https://api.amzofertas.com.br/functions/v1/olx-oauth-callback";

export const OLX_DEFAULT_SCOPE = "basic_user_info autoupload";

/** Categoria OLX: Carros, vans e utilitários (doc autos). */
export const OLX_CATEGORY_CAR = 2020;

export const OLX_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function olxAppUrl(): string {
  return Deno.env.get("APP_URL") || "https://amzofertas.com.br";
}

export function olxIntegracoesRedirect(ok: boolean): string {
  const url = new URL("/configuracoes/integracoes", olxAppUrl());
  url.searchParams.set("olx", ok ? "ok" : "erro");
  return url.toString();
}
