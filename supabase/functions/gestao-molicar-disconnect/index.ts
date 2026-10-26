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
    const { error } = await molicarAdminClient().from("gestao_molicar_conta")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;
    return molicarJson({
      success: true,
      message: "Molicar desconectada. O histórico de consultas foi preservado.",
    });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      500,
    );
  }
});
