export type MolicarCredentials = {
  clientId: string;
  clientSecret: string;
};

export type MolicarToken = {
  accessToken: string;
  expiresAt: number;
};

export class MolicarHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;
const memoryTokens = new Map<string, MolicarToken>();
const TIMEOUT_MS = 20_000;

function env(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function endpoint(name: string, fallback: string): string {
  const value = env(name) || fallback;
  if (
    !/^https:\/\//i.test(value) &&
    !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(value)
  ) {
    throw new Error(`${name} deve usar HTTPS.`);
  }
  return value;
}

async function timedFetch(
  fetcher: Fetcher,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetcher(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Tempo esgotado ao contactar a Molicar.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function responseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) return {};
    throw new Error("Resposta inválida da Molicar.");
  }
}

function apiError(status: number): MolicarHttpError {
  if (status === 401) {
    return new MolicarHttpError(status, "Credenciais Molicar inválidas.");
  }
  if (status === 429) {
    return new MolicarHttpError(
      status,
      "Limite de requisições da Molicar atingido.",
    );
  }
  if (status >= 500) {
    return new MolicarHttpError(status, "Molicar indisponível no momento.");
  }
  return new MolicarHttpError(status, "Consulta Molicar rejeitada.");
}

export async function requestMolicarToken(
  credentials: MolicarCredentials,
  fetcher: Fetcher = fetch,
): Promise<MolicarToken> {
  const tokenUrl = endpoint(
    "MOLICAR_TOKEN_URL",
    "https://auth-decoder.molicar.com.br/oauth2/token",
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const res = await timedFetch(fetcher, tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const json = await responseJson(res) as Record<string, unknown>;
  if (!res.ok) throw apiError(res.status);
  const accessToken = String(json.access_token || json.token || "").trim();
  if (!accessToken) throw new Error("OAuth Molicar não retornou token.");
  const expiresIn = Math.max(60, Number(json.expires_in) || 3600);
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

export async function molicarAccessToken(input: {
  cacheKey: string;
  credentials: MolicarCredentials;
  persisted?: MolicarToken | null;
  forceRefresh?: boolean;
  save?: (token: MolicarToken) => Promise<void>;
  fetcher?: Fetcher;
}): Promise<MolicarToken> {
  const valid = (token?: MolicarToken | null) =>
    !!token && token.expiresAt > Date.now() + 60_000;
  if (!input.forceRefresh) {
    const memory = memoryTokens.get(input.cacheKey);
    if (valid(memory)) return memory!;
    if (valid(input.persisted)) {
      memoryTokens.set(input.cacheKey, input.persisted!);
      return input.persisted!;
    }
  }
  const token = await requestMolicarToken(input.credentials, input.fetcher);
  memoryTokens.set(input.cacheKey, token);
  await input.save?.(token);
  return token;
}

export async function molicarVehicleQuery(input: {
  placa?: string | null;
  vin?: string | null;
  getToken: (forceRefresh: boolean) => Promise<MolicarToken>;
  fetcher?: Fetcher;
}): Promise<{ status: number; body: unknown }> {
  const fetcher = input.fetcher ?? fetch;
  const base = endpoint(
    "MOLICAR_DECODER_URL",
    "https://decoder.molicar.com.br",
  );
  const path = input.placa
    ? `/api/v3/plate/${encodeURIComponent(input.placa)}`
    : `/api/v3/vin/${encodeURIComponent(input.vin!)}`;
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await input.getToken(attempt === 1);
    const res = await timedFetch(fetcher, url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
      },
    });
    const body = await responseJson(res);
    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) throw apiError(res.status);
    return { status: res.status, body };
  }
  throw apiError(401);
}

/** Shared AMZ credentials are allowed only for the explicitly configured AMZ tenant. */
export function restrictedAmzCredentials(
  userId: string,
): MolicarCredentials | null {
  const allowed = new Set(
    env("MOLICAR_AMZ_TENANTS").split(",").map((id) => id.trim()).filter(Boolean),
  );
  if (!allowed.has(userId)) return null;
  const clientId = env("MOLICAR_DECODER_CLIENT_ID");
  const clientSecret = env("MOLICAR_DECODER_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function clearMolicarTokenCacheForTest() {
  memoryTokens.clear();
}
