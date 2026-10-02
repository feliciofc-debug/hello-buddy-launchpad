const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type MetaAdsOAuthState = {
  userId: string;
  expiresAt: number;
  nonce: string;
  returnTo?: string;
};

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decode64url(value: string): ArrayBuffer {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signMetaAdsOAuthState(
  state: MetaAdsOAuthState,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error("OAuth state secret is not configured");
  const payload = base64url(encoder.encode(JSON.stringify(state)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(payload),
  );
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyMetaAdsOAuthState(
  signed: string,
  secret: string,
  now = Date.now(),
): Promise<MetaAdsOAuthState> {
  const [payload, signature, extra] = signed.split(".");
  if (!payload || !signature || extra || !secret) {
    throw new Error("Invalid OAuth state");
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    decode64url(signature),
    encoder.encode(payload),
  );
  if (!valid) throw new Error("Invalid OAuth state");
  const state = JSON.parse(
    decoder.decode(decode64url(payload)),
  ) as MetaAdsOAuthState;
  if (
    !state.userId || !state.nonce || !Number.isFinite(state.expiresAt) ||
    state.expiresAt < now
  ) {
    throw new Error("Expired OAuth state");
  }
  return state;
}
