import { syncGestaoNfeFromFocus, loadFocusTokenForUser } from "../_shared/gestao-nfe-service.ts";
import { gestaoZapsignAdminClient, jsonResponse, optionsResponse } from "../_shared/gestao-zapsign-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const body = await req.json().catch(() => ({})) as { ref?: string; referencia?: string };
    const ref = String(body?.ref ?? body?.referencia ?? "").trim();
    if (!ref) return jsonResponse({ ok: false, error: "missing ref" }, 400);

    const admin = gestaoZapsignAdminClient();
    const { data: nfe } = await admin.from("gestao_nfe").select("id, user_id, focus_ref")
      .eq("focus_ref", ref)
      .maybeSingle();
    if (!nfe) return jsonResponse({ ok: true, ignored: true });

    const auth = await loadFocusTokenForUser(admin, String(nfe.user_id));
    if (!auth) return jsonResponse({ ok: true, ignored: true });

    await syncGestaoNfeFromFocus(
      admin,
      String(nfe.user_id),
      String(nfe.id),
      auth.token,
      auth.ambiente,
      ref,
    );
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: (e as Error).message }, 422);
  }
});
