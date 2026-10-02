import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const GRAPH_VERSION = "v25.0";
const SITE_URL = Deno.env.get("APP_SITE_URL") ??
  "https://www.amzofertas.com.br";
const REDIRECT_URI =
  "https://www.amzofertas.com.br/auth/callback/meta-ads";

function redirect(params: Record<string, string>): Response {
  const url = new URL("/configuracoes", SITE_URL);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );
  return Response.redirect(url.toString(), 302);
}

async function graphJson(url: URL, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(
      `Meta respondeu HTTP ${response.status} (código ${
        Number(body?.error?.code || 0)
      })`,
    );
  }
  return body;
}

serve(async (req) => {
  try {
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!appId || !appSecret || !supabaseUrl || !serviceKey) {
      throw new Error("Configuração do Meta Ads indisponível");
    }

    const requestUrl = new URL(req.url);
    if (requestUrl.searchParams.get("error")) {
      return redirect({
        error: "true",
        platform: "meta_ads",
        message: "Permissão negada pelo usuário.",
      });
    }

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    if (!code || !state || !/^[0-9a-f-]{36}$/i.test(state)) {
      throw new Error("Retorno de autenticação inválido");
    }

    const shortTokenUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    );
    shortTokenUrl.searchParams.set("client_id", appId);
    shortTokenUrl.searchParams.set("client_secret", appSecret);
    shortTokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    shortTokenUrl.searchParams.set("code", code);
    const shortToken = await graphJson(shortTokenUrl);

    const longTokenUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    );
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set(
      "fb_exchange_token",
      String(shortToken.access_token || ""),
    );
    const longToken = await graphJson(longTokenUrl);
    const accessToken = String(longToken.access_token || "");
    if (!accessToken) throw new Error("Token do Meta Ads não recebido");

    const accountsUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts`,
    );
    accountsUrl.searchParams.set(
      "fields",
      "id,name,account_status,currency",
    );
    accountsUrl.searchParams.set("limit", "100");
    accountsUrl.searchParams.set("access_token", accessToken);
    const accountsBody = await graphJson(accountsUrl);
    const accounts = (Array.isArray(accountsBody?.data)
      ? accountsBody.data
      : [])
      .filter((account: any) => account?.id)
      .map((account: any) => ({
        id: String(account.id),
        name: String(account.name || account.id),
        account_status: Number(account.account_status || 0),
        currency: String(account.currency || "BRL"),
      }));
    const selected = accounts.length === 1 ? accounts[0] : null;
    const expiresAt = new Date(
      Date.now() + Number(longToken.expires_in || 5_184_000) * 1000,
    ).toISOString();

    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from("integrations").upsert({
      user_id: state,
      platform: "meta_ads",
      access_token: accessToken,
      token_expires_at: expiresAt,
      is_active: true,
      ad_account_id: selected?.id ?? null,
      ad_account_name: selected?.name ?? null,
      ad_account_currency: selected?.currency ?? null,
      ad_accounts: accounts,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não foi possível salvar a conexão Meta Ads");

    return redirect({
      success: "true",
      platform: "meta_ads",
      accounts: String(accounts.length),
    });
  } catch (error) {
    console.error(
      "[meta-ads-oauth] falha:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return redirect({
      error: "true",
      platform: "meta_ads",
      message: "Não foi possível conectar o Meta Ads. Tente novamente.",
    });
  }
});
