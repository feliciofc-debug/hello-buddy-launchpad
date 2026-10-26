import {
  molicarAdminClient,
  molicarAuthedUser,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return molicarOptions();
  try {
    const user = await molicarAuthedUser(req);
    if (!user) {
      return molicarJson({ success: false, error: "Não autenticado" }, 401);
    }
    const db = molicarAdminClient();
    const { data: conta, error } = await db.from("gestao_molicar_conta")
      .select(
        "client_id, client_secret_ultimos4, status, limite_mensal, atualizar_preco_dias, last_test_ok_at, updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const competence = new Date().toISOString().slice(0, 7) + "-01";
    const { data: quota } = await db.from("molicar_quota_mensal")
      .select("usado")
      .eq("user_id", user.id)
      .eq("competencia", competence)
      .maybeSingle();
    return molicarJson({
      success: true,
      connected: conta?.status === "active",
      status: conta?.status ?? "disconnected",
      client_id: conta?.client_id ?? null,
      client_secret_masked: conta
        ? `••••${conta.client_secret_ultimos4}`
        : null,
      limite_mensal: conta?.limite_mensal ?? null,
      usado_mes: quota?.usado ?? 0,
      atualizar_preco_dias: conta?.atualizar_preco_dias ?? null,
      last_test_ok_at: conta?.last_test_ok_at ?? null,
      updated_at: conta?.updated_at ?? null,
    });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      500,
    );
  }
});
