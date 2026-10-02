const STATE_TTL_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function randomNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createMetaAdsOAuthState(input: {
  userId: string;
  secret: string;
  nowMs?: number;
  nonce?: string;
}): Promise<string> {
  if (!UUID_PATTERN.test(input.userId) || !input.secret) {
    throw new Error("oauth_state_input_invalid");
  }
  const expiresAt = Math.floor((input.nowMs ?? Date.now()) / 1000) +
    STATE_TTL_SECONDS;
  const nonce = input.nonce ?? randomNonce();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(nonce)) {
    throw new Error("oauth_state_nonce_invalid");
  }
  const payload = base64UrlEncode(
    encoder.encode(`${input.userId}.${expiresAt}.${nonce}`),
  );
  const signature = base64UrlEncode(await sign(payload, input.secret));
  return `${payload}.${signature}`;
}

export async function verifyMetaAdsOAuthState(input: {
  state: string;
  secret: string;
  nowMs?: number;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" }
> {
  const [payload, signature, extra] = String(input.state ?? "").split(".");
  if (!payload || !signature || extra || !input.secret) {
    return { ok: false, reason: "invalid" };
  }

  const providedSignature = base64UrlDecode(signature);
  if (!providedSignature) return { ok: false, reason: "invalid" };
  const expectedSignature = await sign(payload, input.secret);
  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: "invalid" };
  }

  const payloadBytes = base64UrlDecode(payload);
  if (!payloadBytes) return { ok: false, reason: "invalid" };
  const decoded = new TextDecoder().decode(payloadBytes);
  const [userId, expiresRaw, nonce, payloadExtra] = decoded.split(".");
  const expiresAt = Number(expiresRaw);
  if (
    payloadExtra ||
    !UUID_PATTERN.test(userId) ||
    !Number.isSafeInteger(expiresAt) ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(nonce)
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (expiresAt <= Math.floor((input.nowMs ?? Date.now()) / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, userId };
}
