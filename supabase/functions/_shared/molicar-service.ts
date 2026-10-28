import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decryptGestaoIntegracaoSecret,
  encryptGestaoIntegracaoSecret,
} from "./gestao-integracoes-crypto.ts";
import {
  molicarAccessToken,
  type MolicarCredentials,
  MolicarHttpError,
  type MolicarToken,
  molicarVehicleQuery,
  requestMolicarToken,
  restrictedAmzCredentials,
} from "./molicar-client.ts";
import {
  normalizeMolicarIdentity,
  parseMolicarResponse,
} from "./molicar-parser.ts";
import { equivalentBrazilianPlates } from "./vehicle-plate.ts";

type Db = SupabaseClient<any, "public", any>;
export const MOLICAR_DAILY_LIMIT = 30;

export class MolicarDailyLimitError extends Error {
  constructor() {
    super(`Limite diário da Molicar atingido (${MOLICAR_DAILY_LIMIT}/dia).`);
  }
}

export type MolicarConta = {
  client_id: string;
  client_secret_enc: string;
  status: string;
  limite_mensal: number;
  atualizar_preco_dias: number;
  procedencia_automatica_troca?: boolean;
  access_token_enc: string | null;
  token_expires_at: string | null;
};

async function loadConta(db: Db, userId: string): Promise<MolicarConta | null> {
  const { data, error } = await db.from("gestao_molicar_conta")
    .select(
      "client_id, client_secret_enc, status, limite_mensal, atualizar_preco_dias, procedencia_automatica_troca, access_token_enc, token_expires_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as MolicarConta | null;
}

export async function resolveMolicarConta(
  db: Db,
  userId: string,
): Promise<{ conta: MolicarConta; credentials: MolicarCredentials }> {
  let conta = await loadConta(db, userId);
  if (conta?.status === "active") {
    return {
      conta,
      credentials: {
        clientId: conta.client_id,
        clientSecret: await decryptGestaoIntegracaoSecret(
          conta.client_secret_enc,
        ),
      },
    };
  }

  const fallback = restrictedAmzCredentials(userId);
  if (!fallback) throw new Error("Conecte a Molicar antes de consultar.");
  const encrypted = await encryptGestaoIntegracaoSecret(fallback.clientSecret);
  const { error } = await db.from("gestao_molicar_conta").upsert({
    user_id: userId,
    client_id: fallback.clientId,
    client_secret_enc: encrypted,
    client_secret_ultimos4: fallback.clientSecret.slice(-4),
    status: "active",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
  conta = await loadConta(db, userId);
  if (!conta) throw new Error("Não foi possível preparar a conexão Molicar.");
  return { conta, credentials: fallback };
}

async function persistedToken(
  conta: MolicarConta,
): Promise<MolicarToken | null> {
  if (!conta.access_token_enc || !conta.token_expires_at) return null;
  try {
    return {
      accessToken: await decryptGestaoIntegracaoSecret(conta.access_token_enc),
      expiresAt: new Date(conta.token_expires_at).getTime(),
    };
  } catch {
    return null;
  }
}

export async function molicarTokenProvider(
  db: Db,
  userId: string,
  conta: MolicarConta,
  credentials: MolicarCredentials,
) {
  return async (forceRefresh: boolean) =>
    await molicarAccessToken({
      cacheKey: `${userId}:${credentials.clientId}`,
      credentials,
      persisted: await persistedToken(conta),
      forceRefresh,
      save: async (token) => {
        const { error } = await db.from("gestao_molicar_conta").update({
          access_token_enc: await encryptGestaoIntegracaoSecret(
            token.accessToken,
          ),
          token_expires_at: new Date(token.expiresAt).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        if (error) throw error;
      },
    });
}

async function consumeQuota(db: Db, userId: string) {
  const { data, error } = await db.rpc("molicar_consumir_quota", {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  assertMolicarQuota(row);
  return { usado: Number(row.usado), limite: Number(row.limite) };
}

export function assertMolicarQuota(
  row: { permitido?: unknown; usado?: unknown; limite?: unknown } | null,
): void {
  if (row?.permitido) return;
  throw new Error(
    `Teto do mês atingido (${Number(row?.usado ?? 0)}/${
      Number(row?.limite ?? 0)
    }).`,
  );
}

export function shouldRefundMolicarQuota(error: unknown): boolean {
  const status = Number((error as { status?: unknown })?.status);
  if ([400, 401, 403, 429].includes(status) || status >= 500) return true;
  const message = String((error as { message?: unknown })?.message ?? "");
  return /tempo esgotado|timeout|timed out|aborterror/i.test(message);
}

async function refundQuota(db: Db, userId: string): Promise<void> {
  const { error } = await db.rpc("molicar_devolver_quota", {
    p_user_id: userId,
  });
  if (error) throw error;
}

async function savePriceReferences(
  db: Db,
  userId: string,
  vehicleId: string,
  prices: Record<string, unknown>,
  capturedAt?: unknown,
): Promise<void> {
  const values = [
    ["molicar_ref", prices.referencia],
    ["molicar_b2c", prices.b2c],
    ["molicar_b2b", prices.b2b],
    ["molicar_c2b", prices.c2b],
  ] as const;
  const capturedDate = typeof capturedAt === "string"
    ? new Date(capturedAt)
    : new Date();
  const rows = values
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([fonte, value]) => ({
      user_id: userId,
      veiculo_id: vehicleId,
      fonte,
      valor: value,
      referencia_mes: capturedDate.toISOString().slice(0, 7),
      ...(typeof capturedAt === "string" ? { capturado_em: capturedAt } : {}),
    }));
  if (!rows.length) return;
  const { error } = await db.from("veiculo_preco_referencia").insert(rows);
  if (error) throw error;
}

function publicSnapshot(row: Record<string, unknown>, cache: boolean) {
  return {
    id: row.id,
    cache,
    consultado_em: row.consultado_em,
    origem: row.origem,
    molicar_id: row.molicar_id,
    placa: row.placa,
    vin: row.vin,
    renavam: row.renavam,
    fipe_codigo: row.fipe_codigo,
    dados: row.dados,
    precos: row.precos,
    procedencia: row.procedencia,
    not_found: snapshotNotFound(row),
  };
}

function saoPauloDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function saoPauloDayStartIso(now = new Date()): string {
  return `${saoPauloDateKey(now)}T03:00:00.000Z`;
}

export function assertMolicarDailyLimit(count: number): void {
  if (count >= MOLICAR_DAILY_LIMIT) throw new MolicarDailyLimitError();
}

async function enforceDailyLimit(db: Db, userId: string): Promise<void> {
  const { count, error } = await db.from("molicar_consulta")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("consultado_em", saoPauloDayStartIso());
  if (error) throw error;
  assertMolicarDailyLimit(Number(count ?? 0));
}

function snapshotNotFound(row: Record<string, unknown>): boolean {
  if (Number(row.http_status) === 404) return true;
  return /RESOURCE_NOT_FOUND/i.test(JSON.stringify(row.dados ?? {}));
}

function semanticNotFound(payload: unknown): boolean {
  return /"?(?:status|code)"?\s*:\s*"?RESOURCE_NOT_FOUND"?/i.test(
    JSON.stringify(payload ?? {}),
  );
}

function sameSaoPauloDay(value: unknown, now = new Date()): boolean {
  const date = new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) &&
    saoPauloDateKey(date) === saoPauloDateKey(now);
}

export function isMolicarNotFoundCacheFresh(
  row: Record<string, unknown>,
  now = new Date(),
): boolean {
  return snapshotNotFound(row) && sameSaoPauloDay(row.consultado_em, now);
}

async function findCache(
  db: Db,
  userId: string,
  identity: { placa: string | null; vin: string | null },
) {
  let query = db.from("molicar_consulta")
    .select(
      "id, molicar_id, placa, vin, renavam, fipe_codigo, dados, precos, procedencia, http_status, consultado_em, origem, veiculo_id, troca_id",
    )
    .eq("user_id", userId)
    .gte("consultado_em", new Date(Date.now() - 365 * 86_400_000).toISOString())
    .order("consultado_em", { ascending: false })
    .limit(1);
  query = identity.placa
    ? query.in("placa", equivalentBrazilianPlates(identity.placa))
    : query.eq("vin", identity.vin);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export function isMolicarPriceCacheFresh(
  row: Record<string, unknown>,
  days: number,
  now = Date.now(),
): boolean {
  const age = now - new Date(String(row.consultado_em)).getTime();
  return age <= days * 86_400_000 &&
    Object.values((row.precos ?? {}) as Record<string, unknown>)
      .some((value) => typeof value === "number" && value > 0);
}

export async function runMolicarConsulta(db: Db, userId: string, input: {
  placa?: unknown;
  vin?: unknown;
  veiculo_id?: unknown;
  troca_id?: unknown;
  origem?: unknown;
  force?: unknown;
}) {
  const identity = normalizeMolicarIdentity(input);
  const origem = ["entrada", "estoque", "troca", "refresh", "manual"].includes(
      String(input.origem),
    )
    ? String(input.origem)
    : "manual";
  const { conta, credentials } = await resolveMolicarConta(db, userId);
  const cached = await findCache(db, userId, identity);
  if (cached && isMolicarNotFoundCacheFresh(cached)) {
    return { ...publicSnapshot(cached, true), quota: null };
  }
  if (
    cached && input.force !== true &&
    isMolicarPriceCacheFresh(cached, conta.atualizar_preco_dias)
  ) {
    const links: Record<string, string> = {};
    if (input.veiculo_id && !cached.veiculo_id) {
      links.veiculo_id = String(input.veiculo_id);
    }
    if (input.troca_id && !cached.troca_id) {
      links.troca_id = String(input.troca_id);
    }
    if (Object.keys(links).length) {
      const { error } = await db.from("molicar_consulta").update(links)
        .eq("id", String(cached.id)).eq("user_id", userId);
      if (error) throw error;
      Object.assign(cached, links);
      if (links.veiculo_id) {
        await savePriceReferences(
          db,
          userId,
          links.veiculo_id,
          (cached.precos ?? {}) as Record<string, unknown>,
          cached.consultado_em,
        );
      }
    }
    return { ...publicSnapshot(cached, true), quota: null };
  }

  await enforceDailyLimit(db, userId);
  const quota = await consumeQuota(db, userId);
  let result: Awaited<ReturnType<typeof molicarVehicleQuery>>;
  try {
    result = await molicarVehicleQuery({
      ...identity,
      getToken: await molicarTokenProvider(db, userId, conta, credentials),
    });
  } catch (error) {
    if (error instanceof MolicarHttpError && error.status === 404) {
      const notFoundSnapshot = {
        user_id: userId,
        placa: identity.placa,
        vin: identity.vin,
        molicar_id: null,
        veiculo_id: input.veiculo_id ? String(input.veiculo_id) : null,
        troca_id: input.troca_id ? String(input.troca_id) : null,
        origem,
        http_status: 404,
        dados: { decoder: { status: "RESOURCE_NOT_FOUND" } },
        precos: {},
        procedencia: null,
        renavam: null,
        fipe_codigo: null,
      };
      const { data: saved, error: saveError } = await db.from(
        "molicar_consulta",
      ).insert(notFoundSnapshot).select(
        "id, molicar_id, placa, vin, renavam, fipe_codigo, dados, precos, procedencia, http_status, consultado_em, origem",
      ).single();
      if (saveError) throw saveError;
      return { ...publicSnapshot(saved, false), quota };
    }
    if (shouldRefundMolicarQuota(error)) {
      await refundQuota(db, userId);
    }
    throw error;
  }
  const parsed = parseMolicarResponse(result.body);
  const notFound = semanticNotFound(result.body);
  const placa = identity.placa ?? parsed.placa;
  const vin = identity.vin ?? parsed.vin;
  const snapshot = {
    user_id: userId,
    placa,
    vin,
    molicar_id: parsed.molicarId,
    veiculo_id: input.veiculo_id ? String(input.veiculo_id) : null,
    troca_id: input.troca_id ? String(input.troca_id) : null,
    origem,
    http_status: result.status,
    dados: notFound
      ? { ...parsed.dados, decoder: { status: "RESOURCE_NOT_FOUND" } }
      : parsed.dados,
    precos: notFound ? {} : parsed.precos,
    procedencia: parsed.procedencia,
    renavam: parsed.renavam,
    fipe_codigo: parsed.fipeCodigo,
  };
  const { data: saved, error } = await db.from("molicar_consulta").insert(
    snapshot,
  )
    .select(
      "id, molicar_id, placa, vin, renavam, fipe_codigo, dados, precos, procedencia, http_status, consultado_em, origem",
    )
    .single();
  if (error) throw error;

  if (snapshot.veiculo_id) {
    await savePriceReferences(
      db,
      userId,
      snapshot.veiculo_id,
      parsed.precos,
    );
  }
  return { ...publicSnapshot(saved, false), quota };
}

export async function testMolicarCredentials(
  clientId: string,
  clientSecret: string,
) {
  await requestMolicarToken({ clientId, clientSecret });
}

export async function decryptMolicarContaSecret(
  conta: { client_secret_enc: string },
) {
  return await decryptGestaoIntegracaoSecret(conta.client_secret_enc);
}
