import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decryptMetaAdsToken,
  metaAdsTokenEncryptionSecret,
} from "./meta-ads-secret.ts";

export const META_GRAPH_VERSION = "v25.0";
export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_ADS_PLATFORM = "meta_ads";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function authenticate(req: Request): Promise<
  { userId: string; admin: ReturnType<typeof adminClient> }
> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Não autenticado.");
  }
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new HttpError(401, "Não autenticado.");
  return { userId: data.user.id, admin };
}

export async function getMetaAdsIntegration(admin: any, userId: string) {
  const { data, error } = await admin
    .from("integrations")
    .select(
      "id,user_id,access_token,token_expires_at,is_active,meta_ad_account_id,meta_ad_account_name,meta_ad_accounts,limite_mensal_anuncios",
    )
    .eq("user_id", userId)
    .eq("platform", META_ADS_PLATFORM)
    .maybeSingle();
  if (error) {
    throw new HttpError(500, "Não foi possível ler a conexão Meta Ads.");
  }
  if (!data?.access_token || data.is_active === false) {
    throw new HttpError(409, "Meta Ads não conectado.");
  }
  if (
    data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now()
  ) {
    throw new HttpError(409, "A conexão Meta Ads expirou. Reconecte-a.");
  }
  if (!data.meta_ad_account_id) {
    throw new HttpError(409, "Selecione uma conta de anúncios.");
  }
  try {
    return {
      ...data,
      access_token: await decryptMetaAdsToken(
        data.access_token,
        metaAdsTokenEncryptionSecret(),
      ),
    };
  } catch {
    throw new HttpError(
      409,
      "Reconecte o Meta Ads para proteger as credenciais.",
    );
  }
}

export async function checkMetaAdsReadiness(
  admin: any,
  userId: string,
  integration: any,
) {
  const [{ data: meta }, { data: whatsapp }, account] = await Promise.all([
    admin.from("meta_connections")
      .select("page_id,ig_account_id,is_active")
      .eq("user_id", userId).eq("is_active", true).maybeSingle(),
    admin.from("whatsapp_config")
      .select("display_phone,is_active")
      .eq("user_id", userId).eq("is_active", true).maybeSingle(),
    graphRequest(
      `${integration.meta_ad_account_id}?fields=account_status,funding_source,funding_source_details`,
      integration.access_token,
    ),
  ]);
  if (!meta?.page_id) {
    throw new HttpError(409, "Conecte uma Página do Facebook ativa.");
  }
  if (!whatsapp?.display_phone) {
    throw new HttpError(409, "Ative uma configuração do WhatsApp.");
  }
  if (Number(account.account_status) !== 1) {
    throw new HttpError(409, "A conta de anúncios não está ativa.");
  }
  const fundingSource = account.funding_source_details?.id ||
    account.funding_source;
  if (!fundingSource) {
    throw new HttpError(
      409,
      "Adicione uma forma de pagamento à conta de anúncios.",
    );
  }
  return {
    accountStatus: Number(account.account_status),
    fundingSource: String(fundingSource),
    pageId: String(meta.page_id),
    instagramId: meta.ig_account_id ? String(meta.ig_account_id) : null,
    whatsappPhone: String(whatsapp.display_phone).replace(/\D/g, ""),
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TOKEN_PATTERN =
  /(access_token|token|client_secret)(["'\s:=]+)([^&\s"',}]+)/gi;

export function redactSecrets(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text
    .replace(TOKEN_PATTERN, "$1$2[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 1000);
}

export async function graphRequest(
  path: string,
  token: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<any> {
  const response = await fetcher(`${META_GRAPH}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const code = payload?.error?.code ? ` (${payload.error.code})` : "";
    throw new Error(
      `Meta Graph API${code}: ${
        redactSecrets(payload?.error?.message || "request failed")
      }`,
    );
  }
  return payload;
}

export async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

export function handleError(error: unknown): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError
    ? error.message
    : "Não foi possível concluir a operação com a Meta.";
  if (!(error instanceof HttpError)) {
    console.error("[meta-ads]", redactSecrets(error));
  }
  return json(status, { success: false, error: message });
}

export function options(req: Request): Response | null {
  return req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders })
    : null;
}
