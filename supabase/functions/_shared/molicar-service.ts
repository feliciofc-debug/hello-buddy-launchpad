import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decryptGestaoIntegracaoSecret,
  encryptGestaoIntegracaoSecret,
} from "./gestao-integracoes-crypto.ts";
import {
  molicarAccessToken,
  type MolicarCredentials,
  type MolicarToken,
  molicarVehicleQuery,
  requestMolicarToken,
  restrictedAmzCredentials,
} from "./molicar-client.ts";
import {
  normalizeMolicarIdentity,
  parseMolicarResponse,
} from "./molicar-parser.ts";

type Db = SupabaseClient<any, "public", any>;

type Conta = {
  client_id: string;
  client_secret_enc: string;
  status: string;
  limite_mensal: number;
  atualizar_preco_dias: number;
  access_token_enc: string | null;
  token_expires_at: string | null;
};

async function loadConta(db: Db, userId: string): Promise<Conta | null> {
  const { data, error } = await db.from("gestao_molicar_conta")
    .select(
      "client_id, client_secret_enc, status, limite_mensal, atualizar_preco_dias, access_token_enc, token_expires_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Conta | null;
}

async function resolveConta(
  db: Db,
  userId: string,
): Promise<{ conta: Conta; credentials: MolicarCredentials }> {
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

async function persistedToken(conta: Conta): Promise<MolicarToken | null> {
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

async function tokenProvider(
  db: Db,
  userId: string,
  conta: Conta,
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

function publicSnapshot(row: Record<string, unknown>, cache: boolean) {
  return {
    id: row.id,
    cache,
    consultado_em: row.consultado_em,
    origem: row.origem,
    molicar_id: row.molicar_id,
    placa: row.placa,
    vin: row.vin,
    fipe_codigo: row.fipe_codigo,
    dados: row.dados,
    precos: row.precos,
    procedencia: row.procedencia,
  };
}

async function findCache(
  db: Db,
  userId: string,
  identity: { placa: string | null; vin: string | null },
) {
  let query = db.from("molicar_consulta")
    .select(
      "id, molicar_id, placa, vin, fipe_codigo, dados, precos, procedencia, consultado_em, origem, veiculo_id, troca_id",
    )
    .eq("user_id", userId)
    .gte("consultado_em", new Date(Date.now() - 365 * 86_400_000).toISOString())
    .order("consultado_em", { ascending: false })
    .limit(1);
  query = identity.placa
    ? query.eq("placa", identity.placa)
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
  const { conta, credentials } = await resolveConta(db, userId);
  const cached = await findCache(db, userId, identity);
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
    }
    return { ...publicSnapshot(cached, true), quota: null };
  }

  const quota = await consumeQuota(db, userId);
  const result = await molicarVehicleQuery({
    ...identity,
    getToken: await tokenProvider(db, userId, conta, credentials),
  });
  const parsed = parseMolicarResponse(result.body);
  const placa = identity.placa ?? parsed.placa;
  const vin = identity.vin ?? parsed.vin;
  const origem = ["entrada", "estoque", "troca", "refresh", "manual"].includes(
      String(input.origem),
    )
    ? String(input.origem)
    : "manual";
  const snapshot = {
    user_id: userId,
    placa,
    vin,
    molicar_id: parsed.molicarId,
    veiculo_id: input.veiculo_id ? String(input.veiculo_id) : null,
    troca_id: input.troca_id ? String(input.troca_id) : null,
    origem,
    http_status: result.status,
    dados: parsed.dados,
    precos: parsed.precos,
    procedencia: parsed.procedencia,
    renavam: parsed.renavam,
    fipe_codigo: parsed.fipeCodigo,
  };
  const { data: saved, error } = await db.from("molicar_consulta").insert(
    snapshot,
  )
    .select(
      "id, molicar_id, placa, vin, fipe_codigo, dados, precos, procedencia, consultado_em, origem",
    )
    .single();
  if (error) throw error;

  if (snapshot.veiculo_id) {
    const referenceMonth = new Date().toISOString().slice(0, 7);
    const rows = (["b2c", "b2b", "c2b"] as const)
      .filter((kind) => parsed.precos[kind] != null)
      .map((kind) => ({
        user_id: userId,
        veiculo_id: snapshot.veiculo_id,
        fonte: `molicar_${kind}`,
        valor: parsed.precos[kind],
        referencia_mes: referenceMonth,
      }));
    if (rows.length) {
      const { error: refsError } = await db.from("veiculo_preco_referencia")
        .insert(rows);
      if (refsError) throw refsError;
    }
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
