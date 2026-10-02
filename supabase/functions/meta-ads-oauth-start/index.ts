import { signMetaAdsOAuthState } from "../_shared/meta-ads-oauth-state.ts";
import {
  authenticate,
  handleError,
  json,
  options,
  readBody,
} from "../_shared/meta-ads-report.ts";

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Método não permitido." });
    }
    const { userId } = await authenticate(req);
    const body = await readBody(req);
    const appId = Deno.env.get("META_APP_ID");
    const secret = Deno.env.get("META_ADS_OAUTH_STATE_SECRET") ||
      Deno.env.get("META_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!appId || !secret || !supabaseUrl) {
      throw new Error("Meta OAuth is not configured");
    }
    const allowedOrigin = Deno.env.get("APP_SITE_URL") ||
      "https://www.amzofertas.com.br";
    const requested = typeof body.returnTo === "string"
      ? body.returnTo
      : `${allowedOrigin}/configuracoes`;
    const returnTo = new URL(requested, allowedOrigin);
    if (returnTo.origin !== new URL(allowedOrigin).origin) {
      throw new Error("Invalid return URL");
    }
    const state = await signMetaAdsOAuthState({
      userId,
      expiresAt: Date.now() + 10 * 60_000,
      nonce: crypto.randomUUID(),
      returnTo: returnTo.toString(),
    }, secret);
    const redirectUri = `${supabaseUrl}/functions/v1/meta-ads-oauth-callback`;
    const url = new URL(`https://www.facebook.com/v25.0/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      "ads_read,ads_management,business_management",
    );
    return json(200, { success: true, authorization_url: url.toString() });
  } catch (error) {
    return handleError(error);
  }
});
