import {
  molicarAdminClient,
  molicarAuthedUser,
  molicarErrorStatus,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";
import { runMolicarProcedenciaQuery } from "../_shared/molicar-procedencia-service.ts";

type Db = ReturnType<typeof molicarAdminClient>;

async function list(db: Db, userId: string, body: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
  let request = db.from("molicar_procedencia")
    .select(
      "id, servicos, identidade_tipo, identidade, placa, vin, veiculo_id, troca_id, protocolo, status, provider_status, resultado, erro, poll_attempts, solicitado_em, updated_at, concluido_em, expires_at",
    )
    .eq("user_id", userId)
    .order("solicitado_em", { ascending: false })
    .limit(limit);
  if (body.id) request = request.eq("id", String(body.id));
  if (body.status) request = request.eq("status", String(body.status));
  if (body.veiculo_id) {
    request = request.eq("veiculo_id", String(body.veiculo_id));
  } else if (body.troca_id) {
    request = request.eq("troca_id", String(body.troca_id));
  } else if (body.placa) {
    request = request.eq(
      "placa",
      String(body.placa).replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    );
  } else if (body.vin) {
    request = request.eq(
      "vin",
      String(body.vin).replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    );
  } else if (!body.id) {
    throw new Error("Informe o vínculo ou a identidade da consulta.");
  }
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

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
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action === "query"
      ? "consultar"
      : body.action === "list"
      ? "listar"
      : body.action;
    if (action !== "consultar" && action !== "listar") {
      throw new Error("A ação deve ser explicitamente consultar ou listar.");
    }
    const db = molicarAdminClient();
    const data = action === "consultar"
      ? await runMolicarProcedenciaQuery(db, user.id, body)
      : await list(db, user.id, body);
    return molicarJson({ success: true, data });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      molicarErrorStatus(error),
    );
  }
});
