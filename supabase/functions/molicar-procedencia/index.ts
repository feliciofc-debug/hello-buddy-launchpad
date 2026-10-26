import {
  molicarAdminClient,
  molicarAuthedUser,
  molicarErrorStatus,
  molicarJson,
  molicarOptions,
} from "../_shared/molicar-http.ts";
import { normalizeMolicarIdentity } from "../_shared/molicar-parser.ts";
import {
  classifyMolicarProcedencia,
  createMolicarProcedencia,
  ensureMolicarWebhookSubscriptions,
  MOLICAR_PROCEDENCIA_SERVICES,
  molicarJobId,
  type MolicarProcedenciaService,
  molicarProviderStatus,
  sanitizeMolicarProcedencia,
} from "../_shared/molicar-procedencia.ts";
import {
  molicarTokenProvider,
  resolveMolicarConta,
} from "../_shared/molicar-service.ts";

type Db = ReturnType<typeof molicarAdminClient>;

function services(value: unknown): MolicarProcedenciaService[] {
  if (!Array.isArray(value)) throw new Error("Informe os serviços desejados.");
  const unique = [...new Set(value.map((item) => String(item).toLowerCase()))];
  if (
    !unique.length ||
    unique.some((item) =>
      !(MOLICAR_PROCEDENCIA_SERVICES as readonly string[]).includes(item)
    )
  ) throw new Error("Serviços de procedência inválidos.");
  return unique as MolicarProcedenciaService[];
}

async function validateTenantLinks(
  db: Db,
  userId: string,
  vehicleId?: unknown,
  tradeId?: unknown,
) {
  for (
    const [table, id, label] of [
      ["veiculos_estoque", vehicleId, "Veículo"],
      ["gestao_troca", tradeId, "Troca"],
    ] as const
  ) {
    if (!id) continue;
    const { data, error } = await db.from(table).select("id")
      .eq("id", String(id)).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`${label} não pertence a esta loja.`);
  }
}

async function finish(
  db: Db,
  id: string,
  status: "concluida" | "erro" | "expirada",
  providerStatus: string | null,
  result: unknown,
  errorMessage: string | null,
) {
  const { error } = await db.rpc("molicar_procedencia_finalizar", {
    p_id: id,
    p_status: status,
    p_provider_status: providerStatus,
    p_resultado: result,
    p_erro: errorMessage,
  });
  if (error) throw error;
}

async function query(db: Db, userId: string, body: Record<string, unknown>) {
  const selected = services(body.services);
  const identity = normalizeMolicarIdentity(body);
  if (identity.placa && identity.vin) {
    throw new Error("Informe somente placa ou chassi/VIN.");
  }
  const identityType = identity.placa ? "plate" : "vin";
  const identityValue = identity.placa ?? identity.vin!;
  if (identityType === "vin" && selected.includes("renajud")) {
    throw new Error("Renajud só possui endpoint oficial por placa.");
  }

  await validateTenantLinks(db, userId, body.veiculo_id, body.troca_id);
  const { conta, credentials } = await resolveMolicarConta(db, userId);
  if (body.automatic === true && !conta.procedencia_automatica_troca) {
    throw new Error(
      "Procedência automática não está habilitada para esta loja.",
    );
  }
  if (body.automatic === true && body.troca_id) {
    const { data: existing, error } = await db.from("molicar_procedencia")
      .select(
        "id, servicos, protocolo, status, provider_status, resultado, erro, solicitado_em, concluido_em",
      )
      .eq("user_id", userId)
      .eq("troca_id", String(body.troca_id))
      .order("solicitado_em", { ascending: false })
      .limit(3);
    if (error) throw error;
    if (existing?.length) return existing;
  }
  const getToken = await molicarTokenProvider(db, userId, conta, credentials);
  await ensureMolicarWebhookSubscriptions({ getToken });

  const { data: reserved, error: reserveError } = await db.rpc(
    "molicar_procedencia_reservar",
    {
      p_user_id: userId,
      p_servicos: selected,
      p_identidade_tipo: identityType,
      p_identidade: identityValue,
      p_veiculo_id: body.veiculo_id ? String(body.veiculo_id) : null,
      p_troca_id: body.troca_id ? String(body.troca_id) : null,
    },
  );
  if (reserveError) throw reserveError;

  const output = [];
  for (const row of reserved ?? []) {
    try {
      const response = await createMolicarProcedencia({
        service: row.servicos[0] as MolicarProcedenciaService,
        identityType,
        identity: identityValue,
        getToken,
      });
      const state = classifyMolicarProcedencia(response.status, response.body);
      const providerStatus = molicarProviderStatus(response.body);
      const jobId = molicarJobId(response.body);
      if (state === "pending") {
        if (!jobId) throw new Error("A Molicar não retornou o JobId.");
        const { error } = await db.from("molicar_procedencia").update({
          protocolo: jobId,
          provider_status: providerStatus ?? "PROCESSING",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("status", "pendente");
        if (error) throw error;
        output.push({ ...row, protocolo: jobId, status: "pendente" });
      } else {
        const terminal = state === "completed"
          ? "concluida"
          : state === "expired"
          ? "expirada"
          : "erro";
        await finish(
          db,
          row.id,
          terminal,
          providerStatus,
          sanitizeMolicarProcedencia(response.body),
          terminal === "concluida" ? null : "Consulta rejeitada pela Molicar.",
        );
        output.push({ ...row, protocolo: jobId, status: terminal });
      }
    } catch (error) {
      await finish(
        db,
        row.id,
        "erro",
        "CREATION_ERROR",
        null,
        (error as Error).message,
      );
      output.push({ ...row, status: "erro", error: (error as Error).message });
    }
  }
  return output;
}

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
      ? await query(db, user.id, body)
      : await list(db, user.id, body);
    return molicarJson({ success: true, data });
  } catch (error) {
    return molicarJson(
      { success: false, error: (error as Error).message },
      molicarErrorStatus(error),
    );
  }
});
