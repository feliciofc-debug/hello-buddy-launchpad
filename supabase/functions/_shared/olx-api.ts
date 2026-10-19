import { OLX_AUTOUPLOAD_IMPORT_URL, OLX_BASIC_USER_INFO_URL, OLX_OAUTH_TOKEN_URL } from "./olx-config.ts";
import type { OlxClientCredentials } from "./olx-credentials.ts";

export type OlxBasicUserInfo = {
  user_name?: string;
  user_email?: string;
};

export async function olxExchangeAuthorizationCode(
  creds: OlxClientCredentials,
  code: string,
): Promise<{ access_token: string; token_type?: string; scope?: string }> {
  const res = await fetch(OLX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      code,
      redirect_uri: creds.redirect_uri,
    }),
  });
  if (!res.ok) {
    console.error("[olx-api] token HTTP", res.status);
    throw new Error("Falha ao obter token OLX");
  }
  return await res.json();
}

export async function olxFetchBasicUserInfo(accessToken: string): Promise<OlxBasicUserInfo> {
  const res = await fetch(OLX_BASIC_USER_INFO_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) {
    console.error("[olx-api] basic_user_info HTTP", res.status);
    throw new Error("Falha ao ler perfil OLX");
  }
  return await res.json();
}

export type OlxAutouploadAd = Record<string, unknown>;

export type OlxImportResponse = {
  token?: string | null;
  statusCode?: number;
  statusMessage?: string;
  errors?: unknown[];
};

export async function olxAutouploadImport(
  accessToken: string,
  adList: OlxAutouploadAd[],
): Promise<OlxImportResponse> {
  const res = await fetch(OLX_AUTOUPLOAD_IMPORT_URL, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ access_token: accessToken, ad_list: adList }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[olx-api] autoupload import HTTP", res.status);
    throw new Error("Falha ao enviar anúncio para OLX");
  }
  return payload as OlxImportResponse;
}

export type OlxImportStatusAd = {
  status?: string;
  operation?: string;
  message?: string;
  list_id?: string;
  url?: string;
};

export type OlxImportStatusResponse = {
  autoupload_status?: string;
  ads?: OlxImportStatusAd[];
};

export async function olxAutouploadImportStatus(
  accessToken: string,
  importToken: string,
): Promise<OlxImportStatusResponse> {
  const url = `${OLX_AUTOUPLOAD_IMPORT_URL}/${encodeURIComponent(importToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[olx-api] import status HTTP", res.status);
    throw new Error("Falha ao consultar status OLX");
  }
  return payload as OlxImportStatusResponse;
}
