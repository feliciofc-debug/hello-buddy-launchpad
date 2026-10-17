const ENC_PREFIX = "mlv1:";

function keyBytes(): Uint8Array {
  const raw = Deno.env.get("ML_TOKEN_KEY") || "";
  if (!raw) throw new Error("ML_TOKEN_KEY não configurado");
  const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bin.length !== 32) throw new Error("ML_TOKEN_KEY deve ser 32 bytes em base64");
  return bin;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes(), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptMlSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey();
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const payload = new Uint8Array(iv.length + enc.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(enc), iv.length);
  return ENC_PREFIX + btoa(String.fromCharCode(...payload));
}

export async function decryptMlSecret(cipher: string): Promise<string> {
  if (!cipher.startsWith(ENC_PREFIX)) throw new Error("token ML cifrado inválido");
  const raw = Uint8Array.from(atob(cipher.slice(ENC_PREFIX.length)), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const key = await importKey();
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}
