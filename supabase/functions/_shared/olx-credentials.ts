const DEFAULT_SECRETS_FILE = "/opt/amz-functions/.secrets/olx_client.json";

export type OlxClientCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scope: string;
};

let cached: OlxClientCredentials | null = null;

/** Apenas testes. */
export function resetOlxCredentialsCache(): void {
  cached = null;
}

function parseSecretsJson(raw: string): OlxClientCredentials {
  const data = JSON.parse(raw) as Record<string, unknown>;
  const client_id = String(data.client_id ?? "").trim();
  const client_secret = String(data.client_secret ?? "").trim();
  const redirect_uri = String(data.redirect_uri ?? "").trim();
  const scope = String(data.scope ?? "").trim();
  if (!client_id || !client_secret) {
    throw new Error("OLX client_id/client_secret ausentes");
  }
  return {
    client_id,
    client_secret,
    redirect_uri: redirect_uri || "https://api.amzofertas.com.br/functions/v1/olx-oauth-callback",
    scope: scope || "basic_user_info autoupload",
  };
}

export async function loadOlxClientCredentials(): Promise<OlxClientCredentials> {
  if (cached) return cached;

  const idEnv = Deno.env.get("OLX_CLIENT_ID")?.trim();
  const secretEnv = Deno.env.get("OLX_CLIENT_SECRET")?.trim();
  if (idEnv && secretEnv) {
    cached = {
      client_id: idEnv,
      client_secret: secretEnv,
      redirect_uri: Deno.env.get("OLX_REDIRECT_URI")?.trim() ||
        "https://api.amzofertas.com.br/functions/v1/olx-oauth-callback",
      scope: Deno.env.get("OLX_SCOPE")?.trim() || "basic_user_info autoupload",
    };
    return cached;
  }

  const path = Deno.env.get("OLX_CLIENT_SECRETS_FILE")?.trim() || DEFAULT_SECRETS_FILE;
  try {
    const text = await Deno.readTextFile(path);
    cached = parseSecretsJson(text);
    return cached;
  } catch (e) {
    console.error("[olx-credentials] Falha ao carregar credenciais OLX:", (e as Error).message);
    throw new Error("Credenciais OLX não configuradas no servidor");
  }
}
