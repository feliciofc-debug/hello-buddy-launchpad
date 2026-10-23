import { competenciaFromYmdSaoPaulo } from "../_shared/gestao-date-br.ts";
import { runGiroFipeRefreshBatch } from "../_shared/giro-fipe-refresh-run.ts";
import {
  gestaoTrocaAdminClient,
  gestaoTrocaAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-troca-http.ts";

const DEFAULT_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoTrocaAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(
      DEFAULT_LIMIT,
      Math.max(1, Number(body?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
    );
    const competenciaAtual = competenciaFromYmdSaoPaulo();
    const skipIds = Array.isArray(body?.skip_ids)
      ? body.skip_ids.map((id: unknown) => String(id))
      : [];
    const sb = gestaoTrocaAdminClient();

    const batch = await runGiroFipeRefreshBatch(sb, user.id, { limit, skipIds });

    return jsonResponse({
      success: true,
      competencia_atual: competenciaAtual,
      processados: batch.processados,
      gravados: batch.gravados,
      nao_encontrados: batch.nao_encontrados,
      pendentes_restantes: batch.pendentes_restantes,
      pendentes_total: batch.pendentes_total,
      resultados: batch.resultados,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
