const ENC_PREFIX = "olxv1:";

export const OLX_TOKEN_KEY_CLIENT_ERROR =
  "Chave de cifragem OLX não configurada no servidor";

const DEFAULT_KEY_FILE = "/opt/amz-functions/.secrets/olx_token_key";

let cachedKeyBytes: Uint8Array | null = null;

export function resetOlxTokenKeyCache(): void {
  cachedKeyBytes = null;
}

function parseKeyBase64(raw: string): Uint8Array {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) throw new Error("chave vazia");
  let bin: Uint8Array;
  try {
    bin = Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("base64 inválido");
  }
  if (bin.length !== 32) throw new Error("tamanho deve ser 32 bytes");
  return bin;
}

async function loadKeyBytes(): Promise<Uint8Array> {
  if (cachedKeyBytes) return cachedKeyBytes;
  const fromEnv = Deno.env.get("OLX_TOKEN_KEY")?.trim();
  if (fromEnv) {
    try {
      cachedKeyBytes = parseKeyBase64(fromEnv);
      return cachedKeyBytes;
    } catch (e) {
      console.error("[olx-token-crypto] OLX_TOKEN_KEY inválida:", (e as Error).message);
      throw new Error(OLX_TOKEN_KEY_CLIENT_ERROR);
    }
  }
  const path = Deno.env.get("OLX_TOKEN_KEY_FILE")?.trim() || DEFAULT_KEY_FILE;
  try {
    const text = await Deno.readTextFile(path);
    cachedKeyBytes = parseKeyBase64(text);
    return cachedKeyBytes;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === OLX_TOKEN_KEY_CLIENT_ERROR) throw e;
    console.error(`[olx-token-crypto] Falha ao ler chave (${path}):`, msg);
    throw new Error(OLX_TOKEN_KEY_CLIENT_ERROR);
  }
}

async function importKey(): Promise<CryptoKey> {
  const bytes = await loadKeyBytes();
  const material = new Uint8Array(bytes);
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptOlxSecret(plain: string): Promise<string> {
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

export async function decryptOlxSecret(cipher: string): Promise<string> {
  if (!cipher.startsWith(ENC_PREFIX)) throw new Error("token OLX cifrado inválido");
  const raw = Uint8Array.from(atob(cipher.slice(ENC_PREFIX.length)), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const key = await importKey();
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}
