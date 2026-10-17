import { runWebmotorsVehicleUnpublish } from "../_shared/webmotors-vehicle-unpublish-run.ts";
import {
  jsonResponse,
  optionsResponse,
  webmotorsAdminClient,
  webmotorsAuthedUser,
} from "../_shared/webmotors-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await webmotorsAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const veiculoId = String(body?.veiculo_id ?? "");
    if (!veiculoId) throw new Error("veiculo_id obrigatório");
    const admin = webmotorsAdminClient();
    const result = await runWebmotorsVehicleUnpublish(admin, {
      userId: user.id,
      veiculoId,
      motivo: body?.motivo,
    });
    return jsonResponse({ success: result.ok, ...result }, result.ok ? 200 : 422);
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 500);
  }
});
