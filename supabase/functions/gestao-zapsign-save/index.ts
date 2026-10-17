import { encryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
import { defaultGestaoContratoModelos } from "../_shared/gestao-contrato-template.ts";
import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  newWebhookSecret,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";

function normalizeAmbiente(v: unknown): "sandbox" | "producao" {
  return v === "producao" ? "producao" : "sandbox";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const token = String(body?.api_token ?? "").trim();
    const ambiente = normalizeAmbiente(body?.ambiente);
    if (token.length < 8) throw new Error("Informe o API token da ZapSign.");

    const api_token_enc = await encryptGestaoIntegracaoSecret(token);
    const admin = gestaoZapsignAdminClient();
    const { data: existing } = await admin.from("gestao_zapsign_conta")
      .select("webhook_secret")
      .eq("user_id", user.id)
      .maybeSingle();

    const webhook_secret = existing?.webhook_secret ?? newWebhookSecret();

    const { error } = await admin.from("gestao_zapsign_conta").upsert({
      user_id: user.id,
      api_token_enc,
      ambiente,
      status: "active",
      webhook_secret,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar a conexão.");

    const { count } = await admin.from("gestao_contrato_modelo")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!count) {
      const rows = defaultGestaoContratoModelos().map((m) => ({ user_id: user.id, ...m }));
      await admin.from("gestao_contrato_modelo").insert(rows);
    }

    return jsonResponse({ success: true, message: "ZapSign conectada." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
