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
    const { data } = await admin.from("gestao_zapsign_conta")
      .select("ambiente, status, usar_conta_amz, last_test_ok_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return jsonResponse({
      success: true,
      connected: !!data && data.status === "active",
      ambiente: data?.ambiente ?? null,
      usar_conta_amz: !!data?.usar_conta_amz,
      last_test_ok_at: data?.last_test_ok_at ?? null,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
