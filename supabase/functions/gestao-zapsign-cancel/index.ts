import { decryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
import { zapsignCancelDoc } from "../_shared/gestao-zapsign-api.ts";
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
    const contratoId = String(body?.contrato_id ?? "");
    if (!contratoId) throw new Error("Informe o contrato.");

    const admin = gestaoZapsignAdminClient();
    const { data: contrato } = await admin.from("gestao_contrato")
      .select("zapsign_doc_token, status")
      .eq("id", contratoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");

    if (contrato.zapsign_doc_token) {
      const { data: conta } = await admin.from("gestao_zapsign_conta")
        .select("api_token_enc, ambiente, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (conta?.status === "active") {
        const token = await decryptGestaoIntegracaoSecret(conta.api_token_enc);
        await zapsignCancelDoc(conta.ambiente, token, contrato.zapsign_doc_token);
      }
    }

    await admin.from("gestao_contrato").update({
      status: "cancelado",
      zapsign_status: "cancelled",
    }).eq("id", contratoId).eq("user_id", user.id);

    return jsonResponse({ success: true, message: "Contrato cancelado." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
