import { ML_OAUTH_STATE_TTL_MS } from "./ml-config.ts";

export function isMlOAuthStateExpired(
  createdAt: string,
  nowMs: number = Date.now(),
): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return true;
  return nowMs - t > ML_OAUTH_STATE_TTL_MS;
}

export function mlOAuthStateExpiryCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - ML_OAUTH_STATE_TTL_MS).toISOString();
}
