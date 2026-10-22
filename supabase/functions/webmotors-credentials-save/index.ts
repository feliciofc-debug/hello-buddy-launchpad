import { encryptWebmotorsSecret } from "../_shared/webmotors-token-crypto.ts";
import { webmotorsServerEnvironment } from "../_shared/webmotors-config.ts";
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
    if (!user) {
      return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    }
    if (webmotorsServerEnvironment() !== "producao") {
      throw new Error(
        "Credenciais de homologação são configuradas somente no servidor.",
      );
    }
    const body = await req.json();
    const cnpj = String(body?.cnpj ?? "").replace(/\D/g, "");
    const email = String(body?.integration_email ?? body?.email ?? "").trim();
    const senha = String(body?.password ?? body?.senha ?? "");
    const defaultModalidade = body?.default_codigo_modalidade != null
      ? Number(body.default_codigo_modalidade)
      : null;

    if (cnpj.length !== 14) {
      throw new Error("Informe um CNPJ válido (14 dígitos).");
    }
    if (!email) throw new Error("Informe o e-mail do usuário de integração.");
    if (!senha) throw new Error("Informe a senha de integração.");

    const password_enc = await encryptWebmotorsSecret(senha);
    const admin = webmotorsAdminClient();
    const { error: upsertError } = await admin.from("webmotors_contas").upsert({
      user_id: user.id,
      cnpj,
      integration_email: email,
      password_enc,
      ambiente: "producao",
      status: "active",
      default_codigo_modalidade: Number.isFinite(defaultModalidade)
        ? defaultModalidade
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      throw new Error(
        "Não foi possível salvar as credenciais. Tente novamente.",
      );
    }

    return jsonResponse({
      success: true,
      message: "Credenciais Webmotors salvas.",
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
