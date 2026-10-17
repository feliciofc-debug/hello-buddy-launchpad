import { decryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
import { focusNfeTestConnection } from "../_shared/gestao-focusnfe-api.ts";
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
    const admin = gestaoZapsignAdminClient();
    const { data } = await admin.from("gestao_focusnfe_conta")
      .select("token_enc, ambiente, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data || data.status !== "active") throw new Error("Conecte a Focus NFe antes de testar.");
    const token = await decryptGestaoIntegracaoSecret(data.token_enc);
    const ambiente = data.ambiente === "producao" ? "producao" : "homolog";
    const result = await focusNfeTestConnection(ambiente, token);
    if (result.ok) {
      await admin.from("gestao_focusnfe_conta").update({
        last_test_ok_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }
    return jsonResponse({ success: result.ok, message: result.message });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
