import { syncGestaoNfeFromFocus, loadFocusTokenForUser } from "../_shared/gestao-nfe-service.ts";
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
    const body = await req.json();
    const nfeId = String(body?.nfe_id ?? "");
    if (!nfeId) throw new Error("Informe a NF-e.");

    const admin = gestaoZapsignAdminClient();
    const auth = await loadFocusTokenForUser(admin, user.id);
    if (!auth) throw new Error("Focus NFe não conectada.");

    const { data: nfe } = await admin.from("gestao_nfe").select("*")
      .eq("user_id", user.id)
      .eq("id", nfeId)
      .maybeSingle();
    if (!nfe?.focus_ref) throw new Error("NF-e não encontrada.");

    await syncGestaoNfeFromFocus(
      admin,
      user.id,
      nfeId,
      auth.token,
      auth.ambiente,
      nfe.focus_ref,
    );

    const { data: updated } = await admin.from("gestao_nfe").select("*")
      .eq("id", nfeId)
      .maybeSingle();

    return jsonResponse({ success: true, nfe: updated });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
