import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { createMetaAdsOAuthState } from "../_shared/meta-ads-oauth-state.ts";

const REDIRECT_URI =
  "https://www.amzofertas.com.br/auth/callback/meta-ads";
const BASE_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const authorization = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !anonKey || !appId || !appSecret || !authorization) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "unauthorized" }, 401);
    const state = await createMetaAdsOAuthState({
      userId: user.id,
      secret: appSecret,
    });
    const authUrl = new URL(
      "https://www.facebook.com/v25.0/dialog/oauth",
    );
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", BASE_SCOPES.join(","));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    return json({ auth_url: authUrl.toString() });
  } catch {
    return json({ error: "oauth_start_failed" }, 500);
  }
});
