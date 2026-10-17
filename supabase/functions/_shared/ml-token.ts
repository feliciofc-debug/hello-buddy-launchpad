import { ML_API_BASE, mlClientId, mlClientSecret } from "./ml-config.ts";
import { decryptMlSecret, encryptMlSecret } from "./ml-token-crypto.ts";

export type MlContaRow = {
  user_id: string;
  ml_user_id: number;
  nickname: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string;
  status: string;
  refresh_lock_until: string | null;
};

const REFRESH_SKEW_MS = 5 * 60 * 1000;
const LOCK_MS = 45 * 1000;

type AdminSb = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, v: string) => {
        maybeSingle: () => Promise<{ data: MlContaRow | null; error?: { message: string } }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (a: string, v: string) => Promise<{ error?: { message: string } | null }>;
    };
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error?: { message: string } | null }>;
  };
};

async function exchangeRefresh(refreshToken: string) {
  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: mlClientId(),
      client_secret: mlClientSecret(),
      refresh_token: refreshToken,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(String(body?.error || "refresh_failed"));
    (err as Error & { code?: string }).code = String(body?.error || "");
    throw err;
  }
  return body as { access_token: string; refresh_token: string; expires_in: number };
}

export async function saveMlContaTokens(
  sb: AdminSb,
  input: {
    userId: string;
    mlUserId: number;
    nickname: string | null;
    accessToken: string;
    refreshToken: string;
    expiresInSec: number;
  },
): Promise<void> {
  const { error } = await sb.from("ml_contas").upsert({
    user_id: input.userId,
    ml_user_id: input.mlUserId,
    nickname: input.nickname,
    access_token_enc: await encryptMlSecret(input.accessToken),
    refresh_token_enc: await encryptMlSecret(input.refreshToken),
    expires_at: new Date(Date.now() + input.expiresInSec * 1000).toISOString(),
    status: "active",
    refresh_lock_until: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function resolveMlUserId(sb: AdminSb, userId: string): Promise<number | null> {
  const { data } = await sb.from("ml_contas")
    .select("ml_user_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status === "revoked") return null;
  return data.ml_user_id as number;
}

export async function getMlAccessTokenForUser(
  sb: AdminSb,
  userId: string,
): Promise<{ accessToken: string; mlUserId: number }> {
  const { data: row, error } = await sb.from("ml_contas")
    .select("user_id, ml_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status, refresh_lock_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.status === "revoked") throw new Error("ml_not_connected");
  if (row.status === "needs_reauth") throw new Error("ml_needs_reauth");

  if (Date.parse(row.expires_at) > Date.now() + REFRESH_SKEW_MS) {
    return {
      accessToken: await decryptMlSecret(row.access_token_enc),
      mlUserId: row.ml_user_id,
    };
  }

  await sb.from("ml_contas").update({
    refresh_lock_until: new Date(Date.now() + LOCK_MS).toISOString(),
  }).eq("user_id", userId);

  try {
    const refreshed = await exchangeRefresh(await decryptMlSecret(row.refresh_token_enc));
    await saveMlContaTokens(sb, {
      userId,
      mlUserId: row.ml_user_id,
      nickname: row.nickname,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresInSec: Number(refreshed.expires_in) || 21600,
    });
    return { accessToken: refreshed.access_token, mlUserId: row.ml_user_id };
  } catch (e) {
    if ((e as Error & { code?: string }).code === "invalid_grant") {
      await sb.from("ml_contas").update({
        status: "needs_reauth",
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      throw new Error("ml_needs_reauth");
    }
    throw e;
  } finally {
    await sb.from("ml_contas").update({ refresh_lock_until: null }).eq("user_id", userId);
  }
}

export async function getMlAccessTokenForMlUser(
  sb: AdminSb,
  mlUserId: number,
): Promise<{ accessToken: string; userId: string }> {
  const { data: row } = await sb.from("ml_contas")
    .select("user_id")
    .eq("ml_user_id", String(mlUserId))
    .maybeSingle();
  if (!row?.user_id) throw new Error("ml_user_unknown");
  const tok = await getMlAccessTokenForUser(sb, row.user_id as string);
  return { accessToken: tok.accessToken, userId: row.user_id as string };
}
