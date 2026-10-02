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
    const query = String(body.query || "").trim().slice(0, 100);
    const kind = String(body.type || "");
    if (query.length < 2 || !["city", "interest"].includes(kind)) {
      throw new HttpError(400, "Busca ou tipo inválido.");
    }
    const integration = await getMetaAdsIntegration(admin, userId);
    const params = new URLSearchParams({ q: query, limit: "25" });
    if (kind === "city") {
      params.set("type", "adgeolocation");
      params.set("location_types", JSON.stringify(["city"]));
      params.set("country_code", "BR");
    } else {
      params.set("type", "adinterest");
    }
    const result = await graphRequest(
      `search?${params}`,
      integration.access_token,
    );
    const data = (result.data ?? [])
      .filter((item: any) => kind !== "city" || item.country_code === "BR")
      .map((item: any) =>
        kind === "city"
          ? {
            key: String(item.key),
            name: item.name,
            region: item.region,
            country_code: item.country_code,
          }
          : {
            id: String(item.id),
            name: item.name,
            audience_size: item.audience_size ?? null,
          }
      );
    return json(200, { success: true, type: kind, data });
  } catch (error) {
    return handleError(error);
  }
});
