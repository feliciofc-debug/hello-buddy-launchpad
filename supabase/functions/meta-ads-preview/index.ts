import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  buildMetaAdsPayloads,
  metaGraphRequest,
  publicMetaAdsError,
  uploadMetaAdsMedia,
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
  const draftId = String(body?.draft_id ?? "");
  if (!draftId) return json({ error: "draft_id_required" }, 400);

  const admin = createClient(url, service);
  const [campaignResult, integrationResult, pageResult, whatsappResult] =
    await Promise.all([
      admin.from("meta_ads_campanhas").select("rascunho,status")
        .eq("id", draftId).eq("user_id", user.id).maybeSingle(),
      admin.from("integrations")
        .select("access_token,token_expires_at,ad_account_id,is_active")
        .eq("user_id", user.id).eq("platform", "meta_ads")
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
    return json({ error: "preview_requires_draft" }, 409);
  }
  if (!integration?.access_token || !integration?.ad_account_id) {
    return json({ error: "meta_ads_not_ready" }, 409);
  }
  if (!page?.page_id) return json({ error: "facebook_page_not_ready" }, 409);
  const validated = validateMetaAdsDraft(row.rascunho);
  if (!validated.ok) return json(validated, 400);
  if (
    validated.draft.objective === "whatsapp" &&
    (!whatsapp?.display_phone || !whatsapp?.phone_number_id)
  ) return json({ error: "whatsapp_not_ready" }, 409);

  try {
    const accessibleDraft = await resolveMetaAdsMediaUrl(
      admin,
      user.id,
      validated.draft,
    );
    const context = {
      accessToken: integration.access_token,
      adAccountId: integration.ad_account_id,
      pageId: page.page_id,
      whatsappPhoneNumber: whatsapp?.display_phone,
      draft: accessibleDraft,
    };
    const media = await uploadMetaAdsMedia(context, fetch);
    const creative = structuredClone(buildMetaAdsPayloads(context).creative);
    if (validated.draft.media_type === "image") {
      creative.object_story_spec.link_data!.image_hash = media.imageHash!;
    } else {
      creative.object_story_spec.video_data!.video_id = media.videoId!;
    }
    const formats = [
      { key: "feed", ad_format: "MOBILE_FEED_STANDARD" },
      { key: "stories", ad_format: "INSTAGRAM_STORY" },
    ];
    const previews = await Promise.all(formats.map(async (format) => {
      const result = await metaGraphRequest(
        `${integration.ad_account_id}/generatepreviews`,
        {
          accessToken: integration.access_token,
          method: "POST",
          params: {
            creative,
            ad_format: format.ad_format,
          },
        },
      );
      return {
        placement: format.key,
        format: format.ad_format,
        body: String(result?.data?.[0]?.body ?? ""),
      };
    }));
    return json({ ok: true, official: true, previews });
  } catch (error) {
    if (error instanceof MetaAdsMediaError) {
      return json({
        error: "media_unavailable",
        message: error.message,
      }, 409);
    }
    const safe = publicMetaAdsError(error);
    return json({ ok: false, ...safe }, 502);
  }
});
