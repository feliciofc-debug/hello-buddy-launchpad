import { molicarAdminClient, molicarJson } from "../_shared/molicar-http.ts";
import {
  classifyMolicarProcedencia,
  constantTimeSecretEqual,
  molicarJobId,
  molicarProviderStatus,
  sanitizeMolicarProcedencia,
} from "../_shared/molicar-procedencia.ts";
import { maybeNotifyMolicarProcedenciaOwner } from "../_shared/molicar-procedencia-notify.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return molicarJson({ success: false, error: "Método não permitido" }, 405);
  }

  const expected = (Deno.env.get("MOLICAR_PROCEDENCIA_WEBHOOK_SECRET") || "")
    .trim();
  const supplied = req.headers.get("X-Molicar-Webhook-Key") || "";
  if (!expected || !constantTimeSecretEqual(supplied, expected)) {
    return molicarJson({ success: false, error: "Não autorizado" }, 401);
  }

  try {
    const body = await req.json();
    const headerJobId = (req.headers.get("X-JobId") || "").trim();
    const bodyJobId = molicarJobId(body);
    if (headerJobId && bodyJobId && headerJobId !== bodyJobId) {
      return molicarJson({ success: false, error: "JobId divergente" }, 400);
    }
    const jobId = headerJobId || bodyJobId;
    if (!jobId) {
      return molicarJson({ success: false, error: "JobId ausente" }, 400);
    }

    const db = molicarAdminClient();
    const { data: protocol, error: findError } = await db
      .from("molicar_procedencia")
      .select(
        "id, user_id, placa, solicitacao_id, notificar_whatsapp, status",
      )
      .eq("protocolo", jobId)
      .maybeSingle();
    if (findError) throw findError;
    if (!protocol) {
      // The provider can complete before the create response is persisted.
      // A 5xx asks it to use the documented redelivery policy.
      return molicarJson({
        success: false,
        error: "JobId ainda não registrado",
      }, 503);
    }
    if (protocol.status !== "pendente") {
      return molicarJson({ success: true, duplicate: true });
    }

    const providerStatus = molicarProviderStatus(body);
    const state = classifyMolicarProcedencia(200, body);
    if (state === "pending") {
      const { error } = await db.from("molicar_procedencia").update({
        provider_status: providerStatus ?? "PROCESSING",
        updated_at: new Date().toISOString(),
      }).eq("id", protocol.id).eq("status", "pendente");
      if (error) throw error;
      return molicarJson({ success: true, pending: true });
    }
    const { data: changed, error } = await db.rpc(
      "molicar_procedencia_finalizar",
      {
        p_id: protocol.id,
        p_status: state === "completed"
          ? "concluida"
          : state === "expired"
          ? "expirada"
          : "erro",
        p_provider_status: providerStatus,
        p_resultado: sanitizeMolicarProcedencia(body),
        p_erro: state === "completed"
          ? null
          : "A Molicar informou erro terminal no processamento.",
      },
    );
    if (error) throw error;
    if (
      changed && protocol.solicitacao_id && protocol.notificar_whatsapp
    ) {
      try {
        await maybeNotifyMolicarProcedenciaOwner(
          db,
          protocol.user_id,
          protocol.solicitacao_id,
        );
      } catch {
        console.warn("[molicar-procedencia] notify_skip", {
          reason: "whatsapp_notify_failed",
        });
      }
    }
    return molicarJson({ success: true, duplicate: !changed });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      500,
    );
  }
});
