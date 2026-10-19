import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { olxExchangeAuthorizationCode, olxFetchBasicUserInfo } from "../_shared/olx-api.ts";
import { olxIntegracoesRedirect } from "../_shared/olx-config.ts";
import { loadOlxClientCredentials } from "../_shared/olx-credentials.ts";
import { maskOlxEmail, validateOlxOAuthStateRow } from "../_shared/olx-oauth-state.ts";
import { encryptOlxSecret } from "../_shared/olx-token-crypto.ts";

Deno.serve(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const erroOAuth = searchParams.get("error_description") || searchParams.get("error");
    if (erroOAuth) {
      return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(false) } });
    }
    if (!code || !state) {
      return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(false) } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow } = await admin.from("olx_oauth_state")
      .select("user_id, expires_at, used_at")
      .eq("state", state)
      .maybeSingle();

    const validation = validateOlxOAuthStateRow(stateRow ?? undefined);
    if (!validation.ok) {
      return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(false) } });
    }

    await admin.from("olx_oauth_state").update({ used_at: new Date().toISOString() }).eq("state", state);

    const creds = await loadOlxClientCredentials();
    let token: { access_token: string; scope?: string };
    try {
      token = await olxExchangeAuthorizationCode(creds, code);
    } catch {
      return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(false) } });
    }

    let profile: { user_name?: string; user_email?: string } = {};
    try {
      profile = await olxFetchBasicUserInfo(token.access_token);
    } catch {
      /* perfil opcional para conexão */
    }

    const enc = await encryptOlxSecret(token.access_token);
    await admin.from("olx_connection").upsert({
      user_id: stateRow!.user_id,
      access_token_enc: enc,
      olx_user_nome: String(profile.user_name ?? "").trim() || null,
      olx_user_email_mascarado: maskOlxEmail(profile.user_email),
      scopes: token.scope ?? creds.scope,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(true) } });
  } catch (e) {
    console.error("[olx-oauth-callback]", (e as Error).message);
    return new Response(null, { status: 302, headers: { Location: olxIntegracoesRedirect(false) } });
  }
});
