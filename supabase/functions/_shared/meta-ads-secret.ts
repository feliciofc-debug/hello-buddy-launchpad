const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): ArrayBuffer {
  const raw = atob(value);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptMetaAdsToken(
  token: string,
  secret: string,
): Promise<string> {
  if (!token || !secret) throw new Error("Token encryption is not configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    encoder.encode(token),
  );
  return `enc:v1:${bytesToBase64(iv)}:${
    bytesToBase64(new Uint8Array(encrypted))
  }`;
}

export async function decryptMetaAdsToken(
  value: string,
  secret: string,
): Promise<string> {
  const [prefix, version, encodedIv, encodedCiphertext] = value.split(":");
  if (
    prefix !== "enc" || version !== "v1" || !encodedIv || !encodedCiphertext ||
    !secret
  ) {
    throw new Error("Encrypted Meta Ads token is invalid");
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encodedIv) },
    await encryptionKey(secret),
    base64ToBytes(encodedCiphertext),
  );
  return decoder.decode(decrypted);
}

export function metaAdsTokenEncryptionSecret(): string {
  const secret = Deno.env.get("META_ADS_TOKEN_ENCRYPTION_KEY") ||
    Deno.env.get("META_APP_SECRET");
  if (!secret) throw new Error("Meta Ads token encryption is not configured");
  return secret;
}
