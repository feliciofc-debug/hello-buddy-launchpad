import { decryptWebmotorsSecret } from "../_shared/webmotors-token-crypto.ts";
import { webmotorsAutenticar } from "../_shared/webmotors-auth.ts";
import { loadWebmotorsConta } from "../_shared/webmotors-conta.ts";
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
    const body = await req.json().catch(() => ({}));
    const admin = webmotorsAdminClient();
    const conta = await loadWebmotorsConta(admin, user.id);

    let cnpj = String(body?.cnpj ?? conta?.cnpj ?? "").replace(/\D/g, "");
    let email = String(body?.integration_email ?? conta?.integration_email ?? "").trim();
    let senha = String(body?.password ?? "");
    const ambiente = body?.ambiente === "producao" ? "producao" : (conta?.ambiente ?? "homolog");

    if (!senha && conta?.password_enc) {
      senha = await decryptWebmotorsSecret(conta.password_enc);
    }
    if (!cnpj || !email || !senha) {
      throw new Error("Preencha CNPJ, e-mail e senha antes de testar.");
    }

    await webmotorsAutenticar({ ambiente, cnpj, email, senha });

    if (conta) {
      await admin.from("webmotors_contas").update({
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }

    return jsonResponse({ success: true, message: "Conexão com a Webmotors OK." });
  } catch (e) {
    const admin = webmotorsAdminClient();
    const { user } = await webmotorsAuthedUser(req);
    if (user) {
      await admin.from("webmotors_contas").update({
        status: "invalid_credentials",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
