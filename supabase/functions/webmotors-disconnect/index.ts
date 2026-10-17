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
    await admin.from("webmotors_contas").delete().eq("user_id", user.id);
    return jsonResponse({
      success: true,
      message: "Webmotors desconectada na AMZ. Os anúncios no portal não são removidos automaticamente.",
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 500);
  }
});
