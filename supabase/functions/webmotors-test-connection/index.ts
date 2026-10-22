import { webmotorsHashForUser } from "../_shared/webmotors-conta.ts";
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
    const admin = webmotorsAdminClient();
    await webmotorsHashForUser(admin, user.id);

    if (webmotorsServerEnvironment() === "producao") {
      await admin.from("webmotors_contas").update({
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }

    return jsonResponse({
      success: true,
      message: "Conexão com a Webmotors OK.",
    });
  } catch (e) {
    if (webmotorsServerEnvironment() === "producao") {
      const admin = webmotorsAdminClient();
      const { user } = await webmotorsAuthedUser(req);
      if (user) {
        await admin.from("webmotors_contas").update({
          status: "invalid_credentials",
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
      }
    }
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
