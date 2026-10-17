import { encryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";

function normalizeAmbiente(v: unknown): "homolog" | "producao" {
  return v === "producao" ? "producao" : "homolog";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const token = String(body?.token ?? body?.api_token ?? "").trim();
    const ambiente = normalizeAmbiente(body?.ambiente);
    const confirmProducao = body?.confirm_producao === true || body?.confirm_producao === "true";

    if (ambiente === "producao" && !confirmProducao) {
      throw new Error(
        "Ambiente de produção exige confirmação explícita (confirm_producao: true).",
      );
    }
    if (token.length < 8) throw new Error("Informe o token da Focus NFe.");

    const token_enc = await encryptGestaoIntegracaoSecret(token);
    const admin = gestaoZapsignAdminClient();
    const { error } = await admin.from("gestao_focusnfe_conta").upsert({
      user_id: user.id,
      token_enc,
      ambiente,
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar a conexão.");

    return jsonResponse({
      success: true,
      message: ambiente === "producao"
        ? "Focus NFe conectada (produção)."
        : "Focus NFe conectada (homologação).",
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
