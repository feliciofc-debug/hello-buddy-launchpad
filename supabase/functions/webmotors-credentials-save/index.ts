import { encryptWebmotorsSecret } from "../_shared/webmotors-token-crypto.ts";
import type { WebmotorsAmbiente } from "../_shared/webmotors-endpoints.ts";
import {
  jsonResponse,
  optionsResponse,
  webmotorsAdminClient,
  webmotorsAuthedUser,
} from "../_shared/webmotors-http.ts";

function normalizeAmbiente(v: unknown): WebmotorsAmbiente {
  return v === "producao" ? "producao" : "homolog";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await webmotorsAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const cnpj = String(body?.cnpj ?? "").replace(/\D/g, "");
    const email = String(body?.integration_email ?? body?.email ?? "").trim();
    const senha = String(body?.password ?? body?.senha ?? "");
    const ambiente = normalizeAmbiente(body?.ambiente);
    const defaultModalidade = body?.default_codigo_modalidade != null
      ? Number(body.default_codigo_modalidade)
      : null;

    if (cnpj.length !== 14) throw new Error("Informe um CNPJ válido (14 dígitos).");
    if (!email) throw new Error("Informe o e-mail do usuário de integração.");
    if (!senha) throw new Error("Informe a senha de integração.");

    const password_enc = await encryptWebmotorsSecret(senha);
    const admin = webmotorsAdminClient();
    await admin.from("webmotors_contas").upsert({
      user_id: user.id,
      cnpj,
      integration_email: email,
      password_enc,
      ambiente,
      status: "active",
      default_codigo_modalidade: Number.isFinite(defaultModalidade) ? defaultModalidade : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return jsonResponse({ success: true, message: "Credenciais Webmotors salvas." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
