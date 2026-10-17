import { cancelGestaoNfe } from "../_shared/gestao-nfe-service.ts";
import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const nfeId = String(body?.nfe_id ?? "");
    const justificativa = String(body?.justificativa ?? "").trim();
    if (!nfeId || justificativa.length < 15) {
      throw new Error("Informe a NF-e e justificativa (mín. 15 caracteres).");
    }

    const admin = gestaoZapsignAdminClient();
    await cancelGestaoNfe(admin, user.id, nfeId, justificativa);
    return jsonResponse({ success: true, message: "Cancelamento solicitado." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
