import {
  isMolicarServiceRequest,
  molicarAdminClient,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";
import { runMolicarConsulta } from "../_shared/molicar-service.ts";
import { VEICULO_STATUS_ATIVOS_INTERNOS } from "../_shared/veiculo-estoque-status.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return molicarOptions();
  if (req.method !== "POST") {
    return molicarJson({ success: false, error: "Método não permitido" }, 405);
  }
  if (!isMolicarServiceRequest(req)) {
    return molicarJson({ success: false, error: "Não autorizado" }, 401);
  }
  const db = molicarAdminClient();
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(100, Math.max(1, Number(body?.limit) || 20));
    let accounts = db.from("gestao_molicar_conta").select(
      "user_id, atualizar_preco_dias",
    ).eq(
      "status",
      "active",
    );
    if (body?.user_id) accounts = accounts.eq("user_id", String(body.user_id));
    const { data: stores, error: storesError } = await accounts;
    if (storesError) throw storesError;

    const results: Array<Record<string, unknown>> = [];
    for (const store of stores ?? []) {
      if (results.length >= limit) break;
      const remaining = limit - results.length;
      const cutoff = new Date(
        Date.now() - Number(store.atualizar_preco_dias ?? 7) * 86_400_000,
      ).toISOString();
      const { data: freshRows, error: freshError } = await db.from(
        "molicar_consulta",
      ).select("veiculo_id").eq("user_id", store.user_id)
        .not("veiculo_id", "is", null).gte("consultado_em", cutoff);
      if (freshError) throw freshError;
      const freshIds = new Set(
        (freshRows ?? []).map((row) => String(row.veiculo_id)),
      );
      const { data: vehicles, error } = await db.from("veiculos_estoque")
        .select("id, placa, chassi, created_at")
        .eq("user_id", store.user_id)
        .in("status", [...VEICULO_STATUS_ATIVOS_INTERNOS])
        .not("placa", "is", null)
        .order("created_at", { ascending: true })
        .limit(Math.min(1000, Math.max(remaining * 10, remaining)));
      if (error) throw error;
      for (const vehicle of vehicles ?? []) {
        if (freshIds.has(String(vehicle.id))) continue;
        try {
          const result = await runMolicarConsulta(db, store.user_id, {
            placa: vehicle.placa,
            vin: vehicle.chassi,
            veiculo_id: vehicle.id,
            origem: "refresh",
          });
          results.push({
            user_id: store.user_id,
            veiculo_id: vehicle.id,
            status: result.cache ? "cache" : "atualizado",
          });
        } catch (error) {
          results.push({
            user_id: store.user_id,
            veiculo_id: vehicle.id,
            status: "erro",
            error: (error as Error).message,
          });
        }
        if (results.length >= limit) break;
      }
    }
    return molicarJson({
      success: true,
      processados: results.length,
      resultados: results,
    });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      422,
    );
  }
});
