import { encryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
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
    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id || "").trim();
    const clientSecret = String(body?.client_secret || "");
    const limite = Math.floor(Number(body?.limite_mensal ?? 50));
    const staleDays = Math.floor(Number(body?.atualizar_preco_dias ?? 7));
    const automaticProcedence = body?.procedencia_automatica_troca === true;
    const db = molicarAdminClient();
    if (
      !body?.client_id && !body?.client_secret &&
      body?.procedencia_automatica_troca !== undefined
    ) {
      const { data, error } = await db.from("gestao_molicar_conta").update({
        procedencia_automatica_troca: automaticProcedence,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id).select("user_id").maybeSingle();
      if (error || !data) {
        throw new Error(
          "Conecte a Molicar antes de alterar esta configuração.",
        );
      }
      return molicarJson({
        success: true,
        message: automaticProcedence
          ? "Consulta automática de procedência ativada."
          : "Consulta automática de procedência desativada.",
      });
    }
    if (clientId.length < 3) throw new Error("Informe o client_id da Molicar.");
    if (clientSecret.length < 8) {
      throw new Error("Informe o client_secret da Molicar.");
    }
    if (limite < 1 || limite > 10_000) {
      throw new Error("Limite mensal inválido.");
    }
    if (staleDays < 1 || staleDays > 365) {
      throw new Error("Prazo de atualização inválido.");
    }

    const { error } = await db.from("gestao_molicar_conta").upsert({
      user_id: user.id,
      client_id: clientId,
      client_secret_enc: await encryptGestaoIntegracaoSecret(clientSecret),
      client_secret_ultimos4: clientSecret.slice(-4),
      status: "active",
      limite_mensal: limite,
      atualizar_preco_dias: staleDays,
      procedencia_automatica_troca: automaticProcedence,
      access_token_enc: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      throw new Error("Não foi possível salvar as credenciais Molicar.");
    }
    return molicarJson({
      success: true,
      message: "Credenciais Molicar salvas.",
    });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      422,
    );
  }
});
