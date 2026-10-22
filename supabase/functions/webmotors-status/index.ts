import { loadWebmotorsConta, maskCnpj } from "../_shared/webmotors-conta.ts";
import {
  isWebmotorsHomologConfigured,
  webmotorsServerEnvironment,
} from "../_shared/webmotors-config.ts";
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
    const admin = webmotorsAdminClient();
    const serverEnvironment = webmotorsServerEnvironment();
    if (serverEnvironment === "homologacao") {
      const configured = isWebmotorsHomologConfigured();
      return jsonResponse({
        success: true,
        connected: configured,
        status: configured ? "active" : "not_configured",
        ambiente: "homolog",
        server_environment: serverEnvironment,
        cnpj_masked: null,
        integration_email: null,
        default_codigo_modalidade: null,
      });
    }
    const conta = await loadWebmotorsConta(admin, user.id);
    const connected = !!conta && conta.status !== "disconnected";
    return jsonResponse({
      success: true,
      connected,
      status: conta?.status ?? "disconnected",
      ambiente: "producao",
      server_environment: serverEnvironment,
      cnpj_masked: conta ? maskCnpj(conta.cnpj) : null,
      integration_email: conta?.integration_email ?? null,
      default_codigo_modalidade: conta?.default_codigo_modalidade ?? null,
      updated_at: conta?.updated_at ?? null,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 500);
  }
});
