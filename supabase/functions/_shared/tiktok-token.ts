export const TIKTOK_RECONNECT_MESSAGE =
  "A conexão com o seu TikTok expirou. Reconecte o TikTok na plataforma para continuar.";
export const TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "O TikTok não respondeu agora. Vou tentar de novo em alguns minutos.";

const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 15 * 1000;

type TikTokIntegration = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  is_active?: boolean | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type TikTokTokenResult =
  | { ok: true; accessToken: string; integration: TikTokIntegration; refreshed: boolean }
  | {
    ok: false;
    error: "not_connected" | "tiktok_reconnect_required" | "tiktok_temporarily_unavailable";
    message: string;
    integration?: TikTokIntegration;
  };

type TikTokTokenOptions = {
  now?: Date;
  fetcher?: typeof fetch;
  waiter?: (milliseconds: number) => Promise<void>;
  forceRefresh?: boolean;
};

export function getTikTokOAuthCredentials() {
  const environment = (Deno.env.get("TIKTOK_ENV") || "sandbox").toLowerCase();
  const isSandbox = environment !== "producao" && environment !== "production";
  return {
    isSandbox,
    clientKey: isSandbox
      ? (Deno.env.get("TIKTOK_CLIENT_KEY_SANDBOX") || "sbawx08s3trep7gfvg")
      : (Deno.env.get("TIKTOK_CLIENT_KEY") || "aw2ouo90dyp4ju9w"),
    clientSecret: isSandbox
      ? Deno.env.get("TIKTOK_CLIENT_SECRET_SANDBOX")
      : Deno.env.get("TIKTOK_CLIENT_SECRET"),
  };
}

function tokenIsValid(integration: TikTokIntegration, now: Date): boolean {
  if (!integration.access_token) return false;
  if (!integration.token_expires_at) return true;
  const expiresAt = new Date(integration.token_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt - now.getTime() >= REFRESH_MARGIN_MS;
}

export function isDefinitiveTikTokRefreshRejection(status: number, payload: any): boolean {
  if (status >= 500 || status === 429) return false;
  if (!((status >= 200 && status < 300) || (status >= 400 && status < 500))) return false;
  const error = payload?.error;
  const details = [
    typeof error === "string" ? error : error?.code,
    error?.message,
    payload?.error_description,
    payload?.description,
    payload?.message,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\binvalid[_\s-]*grant\b/.test(details)) return true;
  return /refresh[_\s-]*token/.test(details)
    && /(invalid|expired|revoked|not[_\s-]*valid|no[_\s-]*longer[_\s-]*valid)/.test(details);
}

function temporaryUnavailable(integration?: TikTokIntegration): TikTokTokenResult {
  return {
    ok: false,
    error: "tiktok_temporarily_unavailable",
    message: TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE,
    integration,
  };
}

async function readIntegration(supabase: any, userId: string): Promise<TikTokIntegration | null> {
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .maybeSingle();
  return data ?? null;
}

async function markReconnectRequired(
  supabase: any,
  integration: TikTokIntegration,
): Promise<void> {
  let query = supabase
    .from("integrations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", integration.id);
  if (integration.refresh_token) {
    query = query.eq("refresh_token", integration.refresh_token);
  }
  await query;
}

async function rereadConcurrentRefresh(
  supabase: any,
  userId: string,
  previousRefreshToken: string,
  previousAccessToken: string,
  now: Date,
  waiter: (milliseconds: number) => Promise<void>,
): Promise<TikTokIntegration | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await waiter(150 * attempt);
    const latest = await readIntegration(supabase, userId);
    if (
      latest
      && latest.is_active !== false
      && (
        latest.refresh_token !== previousRefreshToken
        || latest.access_token !== previousAccessToken
      )
      && tokenIsValid(latest, now)
    ) return latest;
  }
  return null;
}

export async function getValidTikTokAccessToken(
  supabase: any,
  userId: string,
  options: TikTokTokenOptions = {},
): Promise<TikTokTokenResult> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const waiter = options.waiter ?? ((milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const integration = await readIntegration(supabase, userId);

  if (!integration) {
    return { ok: false, error: "not_connected", message: "TikTok não conectado." };
  }
  if (integration.is_active === false) {
    return {
      ok: false,
      error: "tiktok_reconnect_required",
      message: TIKTOK_RECONNECT_MESSAGE,
      integration,
    };
  }
  if (!options.forceRefresh && tokenIsValid(integration, now)) {
    return { ok: true, accessToken: integration.access_token, integration, refreshed: false };
  }
  if (!integration.refresh_token) {
    await markReconnectRequired(supabase, integration);
    return {
      ok: false,
      error: "tiktok_reconnect_required",
      message: TIKTOK_RECONNECT_MESSAGE,
      integration,
    };
  }

  const credentials = getTikTokOAuthCredentials();
  if (!credentials.clientKey || !credentials.clientSecret) {
    console.error("[tiktok-token] configuração OAuth ausente; client_key/client_secret não configurados");
    return temporaryUnavailable(integration);
  }

  let response: Response;
  let payload: any = {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    response = await fetcher("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
      body: new URLSearchParams({
        client_key: credentials.clientKey,
        client_secret: credentials.clientSecret,
        grant_type: "refresh_token",
        refresh_token: integration.refresh_token,
      }),
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    const reason = (error as Error)?.name === "AbortError" ? "timeout" : "falha de rede";
    console.warn(`[tiktok-token] ${reason} ao renovar o token`);
    return temporaryUnavailable(integration);
  } finally {
    clearTimeout(timeoutId);
  }

  const tokenInfo = payload?.data || payload;
  if (!response.ok || !tokenInfo?.access_token) {
    const concurrent = await rereadConcurrentRefresh(
      supabase,
      userId,
      integration.refresh_token,
      integration.access_token,
      now,
      waiter,
    );
    if (concurrent) {
      return { ok: true, accessToken: concurrent.access_token, integration: concurrent, refreshed: true };
    }
    if (isDefinitiveTikTokRefreshRejection(response.status, payload)) {
      await markReconnectRequired(supabase, integration);
      console.warn("[tiktok-token] refresh token recusado definitivamente; reconexão necessária");
      return {
        ok: false,
        error: "tiktok_reconnect_required",
        message: TIKTOK_RECONNECT_MESSAGE,
        integration,
      };
    }
    console.warn(`[tiktok-token] renovação temporariamente indisponível (HTTP ${response.status})`);
    return temporaryUnavailable(integration);
  }

  const expiresIn = Number(tokenInfo.expires_in);
  const expiresAt = new Date(now.getTime() + (Number.isFinite(expiresIn) ? expiresIn : 86400) * 1000);
  const nextRefreshToken = String(tokenInfo.refresh_token || integration.refresh_token);
  const { data: updatedRows, error: updateError } = await supabase
    .from("integrations")
    .update({
      access_token: String(tokenInfo.access_token),
      refresh_token: nextRefreshToken,
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      updated_at: now.toISOString(),
    })
    .eq("id", integration.id)
    .eq("refresh_token", integration.refresh_token)
    .select("*");

  const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
  if (!updateError && updated) {
    return { ok: true, accessToken: updated.access_token, integration: updated, refreshed: true };
  }

  const concurrent = await rereadConcurrentRefresh(
    supabase,
    userId,
    integration.refresh_token,
    integration.access_token,
    now,
    waiter,
  );
  if (concurrent) {
    return { ok: true, accessToken: concurrent.access_token, integration: concurrent, refreshed: true };
  }
  console.error("[tiktok-token] não foi possível persistir a renovação");
  return temporaryUnavailable(integration);
}
