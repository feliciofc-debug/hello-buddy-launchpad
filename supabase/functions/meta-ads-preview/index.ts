import {
  buildSafePayloads,
  uploadAdMedia,
  validateDraft,
} from "../_shared/meta-ads-create.ts";
import {
  authenticate,
  checkMetaAdsReadiness,
  getMetaAdsIntegration,
  graphRequest,
  handleError,
  HttpError,
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
    const { userId, admin } = await authenticate(req);
    const body = await readBody(req);
    const { data: row } = await admin.from("meta_ads_campanhas")
      .select("draft_json").eq("id", body.campaign_id).eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new HttpError(404, "Rascunho não encontrado.");
    const draft = validateDraft(row.draft_json);
    const integration = await getMetaAdsIntegration(admin, userId);
    const ready = await checkMetaAdsReadiness(admin, userId, integration);
    const media = await uploadAdMedia(
      integration.meta_ad_account_id,
      integration.access_token,
      draft,
    );
    const creative = buildSafePayloads(draft, ready, media.imageHash).creative;
    if (media.videoId) {
      const spec: any = creative.object_story_spec;
      const link = spec.link_data;
      delete spec.link_data;
      spec.video_data = {
        video_id: media.videoId,
        message: draft.message,
        call_to_action: link.call_to_action,
      };
    }
    const account = String(integration.meta_ad_account_id);
    const formats = ["MOBILE_FEED_STANDARD", "INSTAGRAM_STORY"];
    const previews = await Promise.all(formats.map(async (adFormat) => {
      const form = new URLSearchParams({
        ad_format: adFormat,
        creative: JSON.stringify(creative),
      });
      const result = await graphRequest(
        `${account}/generatepreviews`,
        integration.access_token,
        { method: "POST", body: form },
      );
      return { format: adFormat, body: result.data?.[0]?.body ?? null };
    }));
    return json(200, { success: true, previews });
  } catch (error) {
    return handleError(error);
  }
});
