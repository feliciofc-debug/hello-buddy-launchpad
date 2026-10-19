import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { OLX_OAUTH_AUTHORIZE_URL } from "../_shared/olx-config.ts";
import { loadOlxClientCredentials } from "../_shared/olx-credentials.ts";
import { olxOAuthStateExpiryIso } from "../_shared/olx-oauth-state.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await loadOlxClientCredentials();
    const state = crypto.randomUUID();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("olx_oauth_state").delete().lt("expires_at", new Date().toISOString());
    const { error } = await admin.from("olx_oauth_state").insert({
      state,
      user_id: user.id,
      expires_at: olxOAuthStateExpiryIso(),
    });
    if (error) throw new Error(error.message);

    const url = new URL(OLX_OAUTH_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", creds.client_id);
    url.searchParams.set("redirect_uri", creds.redirect_uri);
    url.searchParams.set("scope", creds.scope);
    url.searchParams.set("state", state);

    return new Response(JSON.stringify({ success: true, auth_url: url.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[olx-oauth-start]", (e as Error).message);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
