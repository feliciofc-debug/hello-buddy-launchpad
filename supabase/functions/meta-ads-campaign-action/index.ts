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

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Método não permitido." });
    }
    const { userId, admin } = await authenticate(req);
    const body = await readBody(req);
    const action = String(body.action || "");
    if (!["pause", "activate", "status"].includes(action)) {
      throw new HttpError(400, "Ação inválida.");
    }
    const { data: campaign } = await admin.from("meta_ads_campanhas")
      .select("id,status,campaign_id,adset_id,creative_id,ad_id")
      .eq("id", body.campaign_id).eq("user_id", userId).maybeSingle();
    if (!campaign?.campaign_id) {
      throw new HttpError(404, "Campanha publicada não encontrada.");
    }
    const integration = await getMetaAdsIntegration(admin, userId);
    const ids = {
      campaign: campaign.campaign_id,
      adset: campaign.adset_id,
      creative: campaign.creative_id,
      ad: campaign.ad_id,
    };
    if (action === "status") {
      const statuses = Object.fromEntries(
        await Promise.all(
          Object.entries(ids).filter(([, id]) => id).map(async ([kind, id]) => {
            const data = await graphRequest(
              `${id}?fields=id,status,effective_status`,
              integration.access_token,
            );
            return [kind, data];
          }),
        ),
      );
      const remoteCampaign = statuses.campaign;
      const remoteStatus = String(
        remoteCampaign?.effective_status || remoteCampaign?.status || "",
      );
      const localStatus = remoteStatus === "ACTIVE"
        ? "ativo"
        : remoteStatus === "PAUSED"
        ? "pausado"
        : null;
      if (localStatus && localStatus !== campaign.status) {
        const { error: syncError } = await admin.from("meta_ads_campanhas")
          .update({ status: localStatus })
          .eq("id", campaign.id)
          .eq("user_id", userId);
        if (syncError) {
          throw new Error("A Meta respondeu, mas o status local não pôde ser sincronizado.");
        }
      }
      return json(200, { success: true, statuses });
    }
    const target = action === "pause" ? "PAUSED" : "ACTIVE";
    const order = action === "activate"
      ? [ids.ad, ids.adset, ids.campaign]
      : [ids.campaign, ids.adset, ids.ad];
    for (const id of order) {
      if (!id) throw new HttpError(409, "Campanha possui IDs incompletos.");
      await graphRequest(id, integration.access_token, {
        method: "POST",
        body: new URLSearchParams({ status: target }),
      });
    }
    const verified = await graphRequest(
      `${ids.campaign}?fields=id,status,effective_status`,
      integration.access_token,
    );
    const expected = action === "pause" ? "PAUSED" : "ACTIVE";
    if (verified.status !== expected) {
      throw new Error("A Meta não confirmou a alteração de status.");
    }
    await admin.from("meta_ads_campanhas")
      .update({ status: action === "pause" ? "pausado" : "ativo" })
      .eq("id", campaign.id).eq("user_id", userId);
    return json(200, { success: true, status: verified });
  } catch (error) {
    return handleError(error);
  }
});
