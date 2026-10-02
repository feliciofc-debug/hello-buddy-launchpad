import { verifyMetaAdsOAuthState } from "../_shared/meta-ads-oauth-state.ts";
import {
  encryptMetaAdsToken,
  metaAdsTokenEncryptionSecret,
} from "../_shared/meta-ads-secret.ts";
import {
  adminClient,
  corsHeaders,
  graphRequest,
  META_ADS_PLATFORM,
  META_GRAPH,
  redactSecrets,
} from "../_shared/meta-ads-report.ts";

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: location },
  });
}

Deno.serve(async (req) => {
  const fallback = `${
    Deno.env.get("APP_SITE_URL") || "https://www.amzofertas.com.br"
  }/configuracoes`;
  let returnTo = fallback;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const signedState = url.searchParams.get("state");
    if (!code || !signedState || url.searchParams.get("error")) {
      throw new Error("Autorização cancelada ou inválida.");
    }
    const secret = Deno.env.get("META_ADS_OAUTH_STATE_SECRET") ||
      Deno.env.get("META_APP_SECRET");
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!secret || !appId || !appSecret || !supabaseUrl) {
      throw new Error("Meta OAuth is not configured");
    }
    const state = await verifyMetaAdsOAuthState(signedState, secret);
    returnTo = state.returnTo || fallback;
    const redirectUri = `${supabaseUrl}/functions/v1/meta-ads-oauth-callback`;

    const exchange = new URL(`${META_GRAPH}/oauth/access_token`);
    exchange.searchParams.set("client_id", appId);
    exchange.searchParams.set("client_secret", appSecret);
    exchange.searchParams.set("redirect_uri", redirectUri);
    exchange.searchParams.set("code", code);
    const shortResponse = await fetch(exchange, { method: "GET" });
    const short = await shortResponse.json().catch(() => ({}));
    if (!shortResponse.ok || !short.access_token) {
      throw new Error("Falha ao autorizar Meta Ads.");
    }

    const longExchange = new URL(`${META_GRAPH}/oauth/access_token`);
    longExchange.searchParams.set("grant_type", "fb_exchange_token");
    longExchange.searchParams.set("client_id", appId);
    longExchange.searchParams.set("client_secret", appSecret);
    longExchange.searchParams.set("fb_exchange_token", short.access_token);
    const longResponse = await fetch(longExchange);
    const long = await longResponse.json().catch(() => ({}));
    if (!longResponse.ok || !long.access_token) {
      throw new Error("Falha ao criar conexão duradoura.");
    }

    const [profile, accountsResult] = await Promise.all([
      graphRequest("me?fields=id,name", long.access_token),
      graphRequest(
        "me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name,funding_source,funding_source_details&limit=100",
        long.access_token,
      ),
    ]);
    const accounts = (accountsResult.data ?? []).map((account: any) => ({
      id: String(account.id),
      account_id: String(account.account_id),
      name: String(account.name || ""),
      account_status: Number(account.account_status),
      currency: String(account.currency || ""),
      timezone_name: String(account.timezone_name || ""),
      has_funding: Boolean(
        account.funding_source_details?.id || account.funding_source,
      ),
    }));
    const selected = accounts.find((account: any) =>
      account.account_status === 1
    ) ?? accounts[0];
    if (!selected) throw new Error("Nenhuma conta de anúncios acessível.");
    const expiresAt = new Date(
      Date.now() + Number(long.expires_in || 5_184_000) * 1000,
    );
    const admin = adminClient();
    const encryptedToken = await encryptMetaAdsToken(
      String(long.access_token),
      metaAdsTokenEncryptionSecret(),
    );
    const { error } = await admin.from("integrations").upsert({
      user_id: state.userId,
      platform: META_ADS_PLATFORM,
      access_token: encryptedToken,
      meta_user_id: String(profile.id),
      meta_user_name: String(profile.name || ""),
      token_expires_at: expiresAt.toISOString(),
      meta_ad_accounts: accounts,
      meta_ad_account_id: selected.id,
      meta_ad_account_name: selected.name,
      meta_ad_account_currency: selected.currency,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não foi possível salvar a conexão Meta Ads.");
    const destination = new URL(returnTo);
    destination.searchParams.set("meta_ads", "connected");
    return redirect(destination.toString());
  } catch (error) {
    console.error("[meta-ads-oauth-callback]", redactSecrets(error));
    const destination = new URL(returnTo);
    destination.searchParams.set("meta_ads", "error");
    return redirect(destination.toString());
  }
});
