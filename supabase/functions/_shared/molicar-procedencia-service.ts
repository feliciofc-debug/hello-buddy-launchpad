import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeMolicarIdentity } from "./molicar-parser.ts";
import {
  classifyMolicarProcedencia,
  createMolicarProcedencia,
  ensureMolicarWebhookSubscriptions,
  MOLICAR_PROCEDENCIA_SERVICES,
  molicarJobId,
  type MolicarProcedenciaService,
  molicarProviderStatus,
  sanitizeMolicarProcedencia,
} from "./molicar-procedencia.ts";
import {
  molicarTokenProvider,
  resolveMolicarConta,
} from "./molicar-service.ts";

type Db = SupabaseClient<any, "public", any>;

export function normalizeMolicarProcedenciaServices(
  value: unknown,
): MolicarProcedenciaService[] {
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

export async function runMolicarProcedenciaQuery(
  db: Db,
  userId: string,
  body: Record<string, unknown>,
) {
  const selected = normalizeMolicarProcedenciaServices(body.services);
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
  const requestId = crypto.randomUUID();
  const canal = body.canal === "whatsapp"
    ? "whatsapp"
    : body.canal === "automatico" || body.automatic === true
    ? "automatico"
    : "painel";
  const notifyWhatsapp = canal === "whatsapp";
  const reservedRows = (reserved ?? []) as Record<string, unknown>[];
  if (reservedRows.length) {
    const { error } = await db.from("molicar_procedencia").update({
      solicitacao_id: requestId,
      canal,
      notificar_whatsapp: notifyWhatsapp,
    }).in("id", reservedRows.map((row) => String(row.id)));
    if (error) throw error;
    for (const row of reservedRows) {
      row.solicitacao_id = requestId;
      row.canal = canal;
      row.notificar_whatsapp = notifyWhatsapp;
    }
  }

  const output = [];
  for (const row of reservedRows) {
    try {
      const service = Array.isArray(row.servicos)
        ? row.servicos[0] as MolicarProcedenciaService
        : null;
      if (!service) throw new Error("Serviço de procedência inválido.");
      const response = await createMolicarProcedencia({
        service,
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
        }).eq("id", String(row.id)).eq("status", "pendente");
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
          String(row.id),
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
        String(row.id),
        "erro",
        "CREATION_ERROR",
        null,
        (error as Error).message,
      );
      output.push({ ...row, status: "erro" });
    }
  }
  return output;
}
