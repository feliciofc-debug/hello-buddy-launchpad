import { handleVeiculoProcedenciaAction } from "../_shared/veiculo-procedencia-handler.ts";
import {
  jsonResponse,
  optionsResponse,
  procedenciaAdminClient,
  procedenciaAuthedUser,
} from "../_shared/procedencia-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  const body = await req.json().catch(() => ({}));
  const { user } = await procedenciaAuthedUser(req);
  const admin = procedenciaAdminClient();
  const { status, body: payload } = await handleVeiculoProcedenciaAction(
    body as Record<string, unknown>,
    user,
    admin,
  );
  return jsonResponse(payload, status);
});
