import { mapZapsignWebhookStatus } from "../_shared/gestao-zapsign-api.ts";
import { gestaoZapsignAdminClient, jsonResponse, optionsResponse } from "../_shared/gestao-zapsign-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ ok: false }, 405);
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id") ?? "";
    const secret = url.searchParams.get("secret") ?? "";
    if (!userId || !secret) return jsonResponse({ ok: false }, 401);

    const admin = gestaoZapsignAdminClient();
    const { data: conta } = await admin.from("gestao_zapsign_conta")
      .select("webhook_secret, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conta || conta.status !== "active" || conta.webhook_secret !== secret) {
      return jsonResponse({ ok: false }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const docToken = String(payload?.token ?? payload?.doc_token ?? "");
    const eventStatus = String(payload?.status ?? payload?.event_type ?? "");
    if (!docToken) return jsonResponse({ ok: true });

    const mapped = mapZapsignWebhookStatus(eventStatus);
    const updates: Record<string, string> = {
      zapsign_status: eventStatus,
      updated_at: new Date().toISOString(),
    };
    if (mapped === "assinado") updates.status = "assinado";
    if (mapped === "cancelado") updates.status = "cancelado";
    if (mapped === "recusado") updates.status = "recusado";

    await admin.from("gestao_contrato").update(updates)
      .eq("user_id", userId)
      .eq("zapsign_doc_token", docToken);

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ ok: true });
  }
});
