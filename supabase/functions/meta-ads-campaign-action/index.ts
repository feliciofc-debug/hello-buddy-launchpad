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
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? body?.campaign_id ?? "");
  const action = ["pause", "activate", "status"].includes(body?.action)
    ? body.action as "pause" | "activate" | "status"
    : "";
  if (!id || !action) return json({ error: "invalid_action" }, 400);

  const admin = createClient(url, service);
  const [campaignResult, integrationResult] = await Promise.all([
    admin.from("meta_ads_campanhas")
      .select("id,status,campaign_id,adset_id,ad_id")
      .eq("id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("integrations").select("access_token,token_expires_at")
      .eq("user_id", user.id).eq("platform", "meta_ads")
      .eq("is_active", true).maybeSingle(),
  ]);
  const campaign = campaignResult.data;
  const integration = integrationResult.data;
  if (!campaign?.campaign_id) return json({ error: "campaign_not_found" }, 404);
  if (!integration?.access_token) return json({ error: "not_connected" }, 409);
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return json({ error: "token_expired" }, 401);
  }

  try {
    if (action === "status") {
      const remote = await metaGraphRequest(campaign.campaign_id, {
        accessToken: integration.access_token,
        params: { fields: "id,name,status,effective_status" },
      });
      const effective = String(
        remote?.effective_status || remote?.status || "",
      );
      const localStatus = effective === "PAUSED"
        ? "pausado"
        : effective === "ACTIVE"
        ? "publicado"
        : campaign.status;
      if (localStatus !== campaign.status) {
        await admin.from("meta_ads_campanhas").update({
          status: localStatus,
          atualizado_em: new Date().toISOString(),
        }).eq("id", campaign.id).eq("user_id", user.id);
      }
      return json({
        ok: true,
        id: campaign.id,
        status: localStatus,
        graph_status: remote?.status ?? null,
        effective_status: remote?.effective_status ?? null,
      });
    }

    const desired = action === "pause" ? "PAUSED" : "ACTIVE";
    // On activation, restore children before the campaign parent.
    const ids = action === "activate"
      ? [campaign.ad_id, campaign.adset_id, campaign.campaign_id]
      : [campaign.campaign_id];
    for (const graphId of ids.filter(Boolean)) {
      await metaGraphRequest(String(graphId), {
        accessToken: integration.access_token,
        method: "POST",
        params: { status: desired },
      });
    }
    const localStatus = action === "pause" ? "pausado" : "publicado";
    await admin.from("meta_ads_campanhas").update({
      status: localStatus,
      atualizado_em: new Date().toISOString(),
      erro: null,
    }).eq("id", campaign.id).eq("user_id", user.id);
    return json({ ok: true, id: campaign.id, status: localStatus });
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
});
