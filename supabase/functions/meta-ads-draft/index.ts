import {
  enforceMonthlyCap,
  validateDraft,
} from "../_shared/meta-ads-create.ts";
import {
  authenticate,
  getMetaAdsIntegration,
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
    const draft = validateDraft(await readBody(req));
    const integration = await getMetaAdsIntegration(admin, userId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: committed, error: sumError } = await admin
      .from("meta_ads_campanhas")
      .select("gasto_maximo")
      .eq("user_id", userId)
      .gte("aprovado_em", monthStart.toISOString())
      .in("status", [
        "aprovado",
        "publicando",
        "publicado",
        "pausado",
        "ativo",
      ]);
    if (sumError) {
      throw new HttpError(500, "Não foi possível validar o limite mensal.");
    }
    enforceMonthlyCap(
      (committed ?? []).reduce(
        (sum: number, item: any) => sum + Number(item.gasto_maximo),
        0,
      ),
      draft.maxSpend,
      Number(integration.limite_mensal_anuncios || 200),
    );
    const { data, error } = await admin.from("meta_ads_campanhas").insert({
      user_id: userId,
      integration_id: integration.id,
      nome: draft.name,
      status: "rascunho",
      draft_json: draft,
      orcamento_diario: draft.dailyBudget,
      gasto_maximo: draft.maxSpend,
    }).select(
      "id,nome,status,draft_json,orcamento_diario,gasto_maximo,created_at",
    ).single();
    if (error) throw new HttpError(500, "Não foi possível salvar o rascunho.");
    return json(201, { success: true, campaign: data });
  } catch (error) {
    return handleError(error);
  }
});
