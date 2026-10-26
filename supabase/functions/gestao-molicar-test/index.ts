import {
  molicarAdminClient,
  molicarAuthedUser,
  molicarErrorStatus,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";
import {
  decryptMolicarContaSecret,
  testMolicarCredentials,
} from "../_shared/molicar-service.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return molicarOptions();
  const db = molicarAdminClient();
  let userId: string | null = null;
  let testedSavedCredentials = false;
  try {
    const user = await molicarAuthedUser(req);
    if (!user) {
      return molicarJson({ success: false, error: "Não autenticado" }, 401);
    }
    userId = user.id;
    const body = await req.json().catch(() => ({}));
    const { data: conta, error } = await db.from("gestao_molicar_conta")
      .select("client_id, client_secret_enc")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const clientId = String(body?.client_id || conta?.client_id || "").trim();
    const clientSecret = String(
      body?.client_secret || (
        conta ? await decryptMolicarContaSecret(conta) : ""
      ),
    );
    testedSavedCredentials = !body?.client_id && !body?.client_secret && !!conta;
    if (!clientId || !clientSecret) {
      throw new Error("Informe e salve as credenciais Molicar.");
    }
    await testMolicarCredentials(clientId, clientSecret);
    if (conta) {
      await db.from("gestao_molicar_conta").update({
        status: "active",
        last_test_ok_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }
    return molicarJson({ success: true, message: "Conexão com a Molicar OK." });
  } catch (error) {
    if (userId && testedSavedCredentials) {
      await db.from("gestao_molicar_conta").update({
        status: "revoked",
        access_token_enc: null,
        token_expires_at: null,
      }).eq("user_id", userId);
    }
    return molicarJson(
      { success: false, error: (error as Error).message },
      molicarErrorStatus(error),
    );
  }
});
