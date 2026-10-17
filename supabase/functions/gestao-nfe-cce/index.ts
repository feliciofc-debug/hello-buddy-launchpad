import { cceGestaoNfe } from "../_shared/gestao-nfe-service.ts";
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
    const correcao = String(body?.correcao ?? "").trim();
    if (!nfeId || correcao.length < 15) {
      throw new Error("Informe a NF-e e o texto da correção (mín. 15 caracteres).");
    }

    const admin = gestaoZapsignAdminClient();
    await cceGestaoNfe(admin, user.id, nfeId, correcao);
    return jsonResponse({ success: true, message: "Carta de correção enviada." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
