import {
  authenticate,
  getMetaAdsIntegration,
  graphRequest,
  handleError,
  HttpError,
  json,
  options,
  readBody,
} from "../_shared/meta-ads-report.ts";

const DATE_PRESETS = new Set([
  "today",
  "yesterday",
  "this_month",
  "last_month",
  "last_7d",
  "last_14d",
  "last_30d",
]);
const LEVELS = new Set(["account", "campaign", "adset", "ad"]);

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Método não permitido." });
    }
    const { userId, admin } = await authenticate(req);
    const body = await readBody(req);
    const preset = String(body.date_preset || "last_30d");
    const level = String(body.level || "campaign");
    if (!DATE_PRESETS.has(preset) || !LEVELS.has(level)) {
      throw new HttpError(400, "Período ou nível inválido.");
    }
    const integration = await getMetaAdsIntegration(admin, userId);
    const account = String(integration.meta_ad_account_id);
    const params = new URLSearchParams({
      fields:
        "account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,clicks,spend,cpm,cpc,ctr,actions,cost_per_action_type,date_start,date_stop",
      date_preset: preset,
      level,
      limit: "500",
    });
    const result = await graphRequest(
      `${account}/insights?${params}`,
      integration.access_token,
    );
    return json(200, {
      success: true,
      account_id: account,
      currency: integration.meta_ad_accounts?.find?.((item: any) =>
        item.id === account
      )?.currency ?? null,
      date_preset: preset,
      level,
      data: result.data ?? [],
      paging: result.paging ? { next: Boolean(result.paging.next) } : null,
    });
  } catch (error) {
    return handleError(error);
  }
});
