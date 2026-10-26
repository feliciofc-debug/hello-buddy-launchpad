import {
  isMolicarServiceRequest,
  molicarAdminClient,
  molicarJson,
} from "../_shared/molicar-http.ts";
import {
  classifyMolicarProcedencia,
  type MolicarProcedenciaService,
  molicarProviderStatus,
  pollMolicarProcedencia,
  sanitizeMolicarProcedencia,
} from "../_shared/molicar-procedencia.ts";
import {
  molicarTokenProvider,
  resolveMolicarConta,
} from "../_shared/molicar-service.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return molicarJson({ success: false, error: "Método não permitido" }, 405);
  }
  if (!isMolicarServiceRequest(req)) {
    return molicarJson({ success: false, error: "Não autorizado" }, 401);
  }

  const db = molicarAdminClient();
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 100);
    const { data: claimed, error: claimError } = await db.rpc(
      "molicar_procedencia_claim_poll",
      { p_limit: limit },
    );
    if (claimError) throw claimError;

    const tokenProviders = new Map<
      string,
      Promise<
        Awaited<ReturnType<typeof molicarTokenProvider>>
      >
    >();
    const providerFor = (userId: string) => {
      let provider = tokenProviders.get(userId);
      if (!provider) {
        provider = (async () => {
          const { conta, credentials } = await resolveMolicarConta(db, userId);
          return await molicarTokenProvider(db, userId, conta, credentials);
        })();
        tokenProviders.set(userId, provider);
      }
      return provider;
    };

    let completed = 0;
    let pending = 0;
    let failed = 0;
    for (const row of claimed ?? []) {
      try {
        const response = await pollMolicarProcedencia({
          service: row.servicos[0] as MolicarProcedenciaService,
          plate: row.placa,
          jobId: row.protocolo,
          getToken: await providerFor(row.user_id),
        });
        const state = classifyMolicarProcedencia(
          response.status,
          response.body,
        );
        const providerStatus = molicarProviderStatus(response.body);
        const transientHttp = [401, 403, 429].includes(response.status) ||
          response.status >= 500;
        if (state !== "pending" && !transientHttp) {
          const { error } = await db.rpc("molicar_procedencia_finalizar", {
            p_id: row.id,
            p_status: state === "completed"
              ? "concluida"
              : state === "expired"
              ? "expirada"
              : "erro",
            p_provider_status: providerStatus,
            p_resultado: sanitizeMolicarProcedencia(response.body),
            p_erro: state === "completed"
              ? null
              : "A Molicar informou erro terminal no polling.",
          });
          if (error) throw error;
          state === "completed" ? completed++ : failed++;
        } else {
          const { error } = await db.from("molicar_procedencia").update({
            provider_status: providerStatus ??
              (response.status === 202
                ? "PROCESSING"
                : `HTTP_${response.status}`),
            erro: response.status === 202
              ? null
              : "Falha transitória no polling; uma nova tentativa será feita.",
            poll_locked_until: null,
            updated_at: new Date().toISOString(),
          }).eq("id", row.id).eq("status", "pendente");
          if (error) throw error;
          pending++;
        }
      } catch (error) {
        failed++;
        await db.from("molicar_procedencia").update({
          erro: `Falha transitória no polling: ${(error as Error).message}`,
          poll_locked_until: null,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("status", "pendente");
      }
    }
    return molicarJson({
      success: true,
      claimed: claimed?.length ?? 0,
      completed,
      pending,
      failed,
    });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      500,
    );
  }
});
