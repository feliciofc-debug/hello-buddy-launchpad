import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  calculateMetaAdsMonthlyAvailability,
  hasCompleteMetaAdsEntityIds,
  hasExplicitMetaAdsPublishConfirmation,
  metaAdsMaximumSpend,
  metaGraphRequest,
  publicMetaAdsError,
  publishMetaAdsCampaign,
  rollbackMetaAdsCampaign,
  validateMetaAdsDraft,
} from "../_shared/meta-ads-create.ts";
import {
  MetaAdsMediaError,
  resolveMetaAdsMediaUrl,
} from "../_shared/meta-ads-media.ts";

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
  if (!hasExplicitMetaAdsPublishConfirmation(body)) {
    return json({ error: "explicit_confirmation_required" }, 400);
  }
  const draftId = String(body?.draft_id ?? "");
  if (!draftId) return json({ error: "draft_id_required" }, 400);

  const admin = createClient(url, service);
  const [campaignResult, integrationResult, pageResult, whatsappResult] =
    await Promise.all([
      admin.from("meta_ads_campanhas").select("id,rascunho,status")
        .eq("id", draftId).eq("user_id", user.id).maybeSingle(),
      admin.from("integrations").select(
        "access_token,token_expires_at,ad_account_id,is_active,limite_mensal_anuncios",
      ).eq("user_id", user.id).eq("platform", "meta_ads")
        .eq("is_active", true).maybeSingle(),
      admin.from("meta_connections").select("page_id,is_active")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle(),
      admin.from("whatsapp_config")
        .select("display_phone,phone_number_id,is_active,is_verified")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    ]);
  const row = campaignResult.data;
  const integration = integrationResult.data;
  const page = pageResult.data;
  const whatsapp = whatsappResult.data;
  if (!row) return json({ error: "draft_not_found" }, 404);
  if (row.status !== "rascunho") {
    return json({ error: "draft_already_processed" }, 409);
  }
  if (!integration?.access_token || !integration?.ad_account_id) {
    return json({ error: "meta_ads_not_ready" }, 409);
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return json({ error: "token_expired" }, 401);
  }
  if (!page?.page_id) return json({ error: "facebook_page_not_ready" }, 409);
  const validated = validateMetaAdsDraft(row.rascunho);
  if (!validated.ok) return json(validated, 400);
  if (
    validated.draft.objective === "whatsapp" &&
    (!whatsapp?.display_phone || !whatsapp?.phone_number_id ||
      whatsapp.is_active !== true)
  ) return json({ error: "whatsapp_not_ready" }, 409);

  let draftWithThumbnail = validated.draft;
  if (
    validated.draft.media_type === "video" &&
    validated.draft.media_source === "midias_whatsapp" &&
    validated.draft.media_id
  ) {
    const { data: sourceMedia } = await admin.from("midias_whatsapp")
      .select("thumbnail_url")
      .eq("id", validated.draft.media_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const thumbnailUrl = String(sourceMedia?.thumbnail_url ?? "").trim();
    try {
      if (new URL(thumbnailUrl).protocol === "https:") {
        draftWithThumbnail = {
          ...validated.draft,
          thumbnail_url: thumbnailUrl,
        };
      }
    } catch {
      // A miniatura gerada pela Meta continua sendo a primeira opção.
    }
  }
  let accessibleDraft = draftWithThumbnail;
  try {
    accessibleDraft = await resolveMetaAdsMediaUrl(
      admin,
      user.id,
      draftWithThumbnail,
    );
  } catch (error) {
    if (error instanceof MetaAdsMediaError) {
      return json({
        error: "media_unavailable",
        message: error.message,
      }, 409);
    }
    return json({ error: "media_unavailable" }, 409);
  }

  try {
    const account = await metaGraphRequest(integration.ad_account_id, {
      accessToken: integration.access_token,
      params: {
        fields:
          "account_status,disable_reason,funding_source_details,is_prepay_account,balance",
      },
    });
    if (Number(account?.account_status) !== 1) {
      return json({
        error: "ad_account_not_active",
        disable_reason: Number(account?.disable_reason || 0),
      }, 409);
    }
    if (
      !account?.funding_source_details && account?.is_prepay_account !== true
    ) {
      const accountId = String(integration.ad_account_id).replace(/^act_/, "");
      return json({
        error: "funding_source_required",
        billing_url:
          `https://adsmanager.facebook.com/billing_hub/payment_settings/?asset_id=${accountId}`,
      }, 409);
    }
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }

  const { data: platformRows, error: capLoadError } = await admin
    .from("meta_ads_campanhas")
    .select("id,campaign_id,gasto_maximo,status")
    .eq("user_id", user.id)
    .in("status", ["publicando", "publicado", "pausado"]);
  if (capLoadError) return json({ error: "monthly_cap_check_failed" }, 500);
  const rows = (platformRows ?? []) as Array<{
    id: string;
    campaign_id: string | null;
    gasto_maximo: number | string | null;
    status: string;
  }>;
  let actualSpent = 0;
  const activeCampaigns: Array<{
    maximumSpend: number;
    lifetimeSpent: number;
  }> = [];
  try {
    const accountInsights = await metaGraphRequest(
      `${integration.ad_account_id}/insights`,
      {
        accessToken: integration.access_token,
        params: {
          fields: "spend",
          level: "account",
          date_preset: "this_month",
          limit: 1,
        },
      },
    );
    actualSpent = Number(accountInsights?.data?.[0]?.spend || 0);
    await Promise.all(
      rows
        .filter((platform) =>
          platform.status !== "publicando" && platform.campaign_id
        )
        .map(async (platform) => {
          const campaign = await metaGraphRequest(
            String(platform.campaign_id),
            {
              accessToken: integration.access_token,
              params: { fields: "effective_status" },
            },
          );
          if (campaign?.effective_status !== "ACTIVE") return;
          const insights = await metaGraphRequest(
            `${platform.campaign_id}/insights`,
            {
              accessToken: integration.access_token,
              params: { fields: "spend", date_preset: "maximum", limit: 1 },
            },
          );
          activeCampaigns.push({
            maximumSpend: Number(platform.gasto_maximo || 0),
            lifetimeSpent: Number(insights?.data?.[0]?.spend || 0),
          });
        }),
    );
  } catch (error) {
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const availability = calculateMetaAdsMonthlyAvailability({
    monthlyCap: integration.limite_mensal_anuncios,
    actualSpent,
    activeCampaigns,
    inFlightReservations: rows
      .filter((platform) => platform.status === "publicando")
      .map((platform) => platform.gasto_maximo),
    daysRemaining: daysInMonth - now.getUTCDate() + 1,
  });
  const maximumSpend = metaAdsMaximumSpend(validated.draft);
  if (maximumSpend > availability.available) {
    return json({
      error: "monthly_cap_exceeded",
      requested: maximumSpend,
      ...availability,
      suggested_daily: availability.suggestedDaily,
    }, 409);
  }

  const committedWithoutInflight = Math.round(
    (availability.spent + availability.activeReservedRemaining) * 100,
  ) / 100;
  const { data: reservation, error: reservationError } = await admin.rpc(
    "reserve_meta_ads_publish",
    {
      p_user_id: user.id,
      p_campaign_id: draftId,
      p_committed_without_inflight: committedWithoutInflight,
      p_observed_campaign_ids: rows
        .filter((platform) => platform.status !== "publicando")
        .map((platform) => platform.id),
    },
  );
  if (reservationError) {
    return json({ error: "publish_reservation_failed" }, 500);
  }
  if (!reservation?.ok) {
    return json({
      error: reservation?.reason ?? "draft_already_processed",
      reservation,
    }, reservation?.reason === "monthly_cap_exceeded" ? 409 : 409);
  }

  const releaseReservation = async (errorCode: string) => {
    const { data, error } = await admin.from("meta_ads_campanhas").update({
      status: "rascunho",
      aprovado_em: null,
      erro: errorCode,
      atualizado_em: new Date().toISOString(),
    }).eq("id", draftId).eq("user_id", user.id).eq("status", "publicando")
      .select("id").maybeSingle();
    return !error && Boolean(data);
  };

  try {
    const ids = await publishMetaAdsCampaign({
      accessToken: integration.access_token,
      adAccountId: integration.ad_account_id,
      pageId: page.page_id,
      whatsappPhoneNumber: whatsapp?.display_phone,
      draft: accessibleDraft,
    });
    if (!hasCompleteMetaAdsEntityIds(ids)) {
      const rolledBack = await rollbackMetaAdsCampaign(
        ids,
        integration.access_token,
      );
      const safeToRelease = !String(ids?.campaign_id ?? "") || rolledBack;
      const released = safeToRelease
        ? await releaseReservation("incomplete_graph_ids")
        : false;
      return json({
        error: released
          ? "incomplete_graph_ids"
          : "publish_reservation_release_failed",
      }, 500);
    }
    const approvedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin
      .from("meta_ads_campanhas")
      .update({
        ...ids,
        status: "publicado",
        aprovado_em: approvedAt,
        atualizado_em: approvedAt,
        gasto_maximo: maximumSpend,
        erro: null,
      })
      .eq("id", draftId)
      .eq("user_id", user.id)
      .eq("status", "publicando")
      .select("id")
      .maybeSingle();
    if (saveError || !saved) {
      const rolledBack = await rollbackMetaAdsCampaign(
        ids,
        integration.access_token,
      );
      const released = rolledBack
        ? await releaseReservation("publish_state_save_failed")
        : false;
      return json({
        error: "publish_state_save_failed",
        graph_rollback: rolledBack,
        reservation_released: released,
      }, 500);
    }
    return json({
      ok: true,
      id: draftId,
      graph: ids,
      maximum_spend: maximumSpend,
      spent: availability.spent,
      available: availability.available,
      available_after_publish: Math.round(
        (availability.available - maximumSpend) * 100,
      ) / 100,
      suggested_daily: availability.suggestedDaily,
    });
  } catch (error) {
    const safe = publicMetaAdsError(error);
    const released = await releaseReservation(safe.code);
    if (!released) {
      return json({
        ok: false,
        error: "publish_reservation_release_failed",
      }, 500);
    }
    return json({ ok: false, ...safe }, 502);
  }
});
