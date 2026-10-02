import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  metaGraphRequest,
  publicMetaAdsError,
} from "../_shared/meta-ads-create.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") ?? "";
  if (!url || !anon || !service || !authorization) {
    return json({ error: "unauthorized" }, 401);
  }

  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, service);
  const { data: integration, error: integrationError } = await admin
    .from("integrations")
    .select("access_token,token_expires_at,ad_account_id")
    .eq("user_id", user.id)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .maybeSingle();
  if (integrationError) return json({ error: "integration_check_failed" }, 500);
  if (!integration?.access_token || !integration?.ad_account_id) {
    return json({ error: "meta_ads_not_ready" }, 409);
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return json({ error: "token_expired" }, 401);
  }

  const accountId = String(integration.ad_account_id).replace(/^act_/, "");
  const billingUrl =
    `https://adsmanager.facebook.com/billing_hub/payment_settings/?asset_id=${accountId}`;
  try {
    const account = await metaGraphRequest(integration.ad_account_id, {
      accessToken: integration.access_token,
      params: {
        fields:
          "account_status,disable_reason,funding_source_details,is_prepay_account",
      },
    });
    const accountActive = Number(account?.account_status) === 1;
    const paymentConfigured = Boolean(account?.funding_source_details) ||
      account?.is_prepay_account === true;
    return json({
      ok: true,
      account_id: accountId,
      billing_url: billingUrl,
      account_active: accountActive,
      payment_configured: paymentConfigured,
      account_status: Number(account?.account_status ?? 0),
      disable_reason: Number(account?.disable_reason ?? 0),
    });
  } catch (error) {
    return json({ ok: false, ...publicMetaAdsError(error) }, 502);
  }
});
