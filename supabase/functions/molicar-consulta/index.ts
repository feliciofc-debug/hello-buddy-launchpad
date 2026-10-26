import {
  molicarAdminClient,
  molicarAuthedUser,
  molicarErrorStatus,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";
import { runMolicarConsulta } from "../_shared/molicar-service.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return molicarOptions();
  if (req.method !== "POST") {
    return molicarJson({ success: false, error: "Método não permitido" }, 405);
  }
  try {
    const user = await molicarAuthedUser(req);
    if (!user) {
      return molicarJson({ success: false, error: "Não autenticado" }, 401);
    }
    const body = await req.json().catch(() => ({}));
    const result = await runMolicarConsulta(
      molicarAdminClient(),
      user.id,
      body,
    );
    return molicarJson({ success: true, ...result });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      molicarErrorStatus(error),
    );
  }
});
