import { OLX_OAUTH_STATE_TTL_MS } from "./olx-config.ts";

export type OlxOAuthStateRow = {
  user_id: string;
  expires_at: string;
  used_at: string | null;
};

export type OlxOAuthStateRejectReason =
  | "invalid"
  | "expired"
  | "reused";

export function isOlxOAuthStateExpired(
  expiresAt: string,
  nowMs: number = Date.now(),
): boolean {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return true;
  return t <= nowMs;
}

export function olxOAuthStateExpiryIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + OLX_OAUTH_STATE_TTL_MS).toISOString();
}

export function validateOlxOAuthStateRow(
  row: OlxOAuthStateRow | null | undefined,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; reason: OlxOAuthStateRejectReason } {
  if (!row) return { ok: false, reason: "invalid" };
  if (row.used_at) return { ok: false, reason: "reused" };
  if (isOlxOAuthStateExpired(row.expires_at, nowMs)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function maskOlxEmail(email: string | null | undefined): string | null {
  const raw = String(email ?? "").trim();
  const at = raw.indexOf("@");
  if (at <= 0) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!domain) return null;
  const visible = local.slice(0, Math.min(1, local.length));
  return `${visible}${local.length > 1 ? "***" : ""}@${domain}`;
}
