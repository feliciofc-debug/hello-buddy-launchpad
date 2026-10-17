import { loadWebmotorsConta, maskCnpj } from "../_shared/webmotors-conta.ts";
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
    const admin = webmotorsAdminClient();
    const conta = await loadWebmotorsConta(admin, user.id);
    const connected = !!conta && conta.status !== "disconnected";
    return jsonResponse({
      success: true,
      connected,
      status: conta?.status ?? "disconnected",
      ambiente: conta?.ambiente ?? "homolog",
      cnpj_masked: conta ? maskCnpj(conta.cnpj) : null,
      integration_email: conta?.integration_email ?? null,
      default_codigo_modalidade: conta?.default_codigo_modalidade ?? null,
      updated_at: conta?.updated_at ?? null,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 500);
  }
});
