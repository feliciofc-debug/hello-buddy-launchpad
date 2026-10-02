import {
  assertPublishConfirmed,
  publishMetaCampaign,
  rollbackMetaEntities,
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
  redactSecrets,
} from "../_shared/meta-ads-report.ts";

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  let admin: any;
  let campaignId: string | undefined;
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Método não permitido." });
    }
    const auth = await authenticate(req);
    admin = auth.admin;
    const body = await readBody(req);
    try {
      assertPublishConfirmed(body.confirmed);
    } catch {
      throw new HttpError(400, "Confirmação explícita é obrigatória.");
    }
    campaignId = String(body.campaign_id || "");
    if (!campaignId) throw new HttpError(400, "Campanha inválida.");
    const integration = await getMetaAdsIntegration(admin, auth.userId);
    const { data: reserved, error: reserveError } = await admin.rpc(
      "meta_ads_reservar_publicacao",
      {
        p_user_id: auth.userId,
        p_campanha_id: campaignId,
      },
    );
    if (reserveError || !reserved) {
      throw new HttpError(
        409,
        reserveError?.message?.includes("limite")
          ? "Limite mensal de anúncios excedido."
          : "A campanha não pode ser publicada.",
      );
    }
    const ready = await checkMetaAdsReadiness(admin, auth.userId, integration);
    const draft = validateDraft(reserved.draft_json);
    const ids = await publishMetaCampaign(
      integration.meta_ad_account_id,
      integration.access_token,
      draft,
      ready,
    );
    const { data: saved, error: saveError } = await admin.from(
      "meta_ads_campanhas",
    ).update({
      ...ids,
      status: "publicado",
      publicado_em: new Date().toISOString(),
      erro_em: null,
      ultimo_erro: null,
    }).eq("id", campaignId).eq("user_id", auth.userId).eq(
      "status",
      "publicando",
    )
      .select("id,status,campaign_id,adset_id,creative_id,ad_id,publicado_em")
      .single();
    if (saveError || !saved) {
      await rollbackMetaEntities(ids, integration.access_token, graphRequest);
      throw new Error(
        "A publicação foi revertida porque não pôde ser persistida.",
      );
    }
    return json(200, { success: true, campaign: saved });
  } catch (error) {
    if (admin && campaignId) {
      const safe = redactSecrets(error);
      await admin.from("meta_ads_campanhas").update({
        status: "erro",
        erro_em: new Date().toISOString(),
        ultimo_erro: safe,
      }).eq("id", campaignId).eq("status", "publicando");
    }
    return handleError(error);
  }
});
