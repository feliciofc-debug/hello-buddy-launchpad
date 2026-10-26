export const GESTAO_COFRE_FORMAT_VERSION = "k1";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new Error("DOC_COFRE_KEY inválida");
  }
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

export function carregarChaveCofreBytes(
  keyBase64 = Deno.env.get("DOC_COFRE_KEY") ?? "",
): Uint8Array {
  if (!keyBase64.trim()) throw new Error("DOC_COFRE_KEY não configurada");
  const key = base64ToBytes(keyBase64.trim());
  if (key.byteLength !== 32) {
    throw new Error("DOC_COFRE_KEY deve conter 32 bytes em base64");
  }
  return key;
}

async function importarChave(keyBase64?: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    ownedBuffer(carregarChaveCofreBytes(keyBase64)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Formato: k1.<iv base64>.<ciphertext+tag base64>. */
export async function cifrarCofreBytes(
  plaintext: Uint8Array,
  keyBase64?: string,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importarChave(keyBase64);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ownedBuffer(iv) },
      key,
      ownedBuffer(plaintext),
    ),
  );
  return new TextEncoder().encode(
    `${GESTAO_COFRE_FORMAT_VERSION}.${bytesToBase64(iv)}.${
      bytesToBase64(encrypted)
    }`,
  );
}

export async function decifrarCofreBytes(
  payload: Uint8Array,
  keyBase64?: string,
): Promise<Uint8Array> {
  const [version, ivRaw, cipherRaw, extra] = new TextDecoder().decode(payload)
    .split(".");
  if (
    version !== GESTAO_COFRE_FORMAT_VERSION || !ivRaw || !cipherRaw || extra
  ) {
    throw new Error("Formato de cofre inválido");
  }
  const key = await importarChave(keyBase64);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ownedBuffer(base64ToBytes(ivRaw)) },
        key,
        ownedBuffer(base64ToBytes(cipherRaw)),
      ),
    );
  } catch {
    throw new Error("Não foi possível decifrar o documento");
  }
}

export async function cifrarDadosPessoais(
  dados: Record<string, unknown>,
  keyBase64?: string,
): Promise<string> {
  const bytes = await cifrarCofreBytes(
    new TextEncoder().encode(JSON.stringify(dados)),
    keyBase64,
  );
  return new TextDecoder().decode(bytes);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", ownedBuffer(bytes)),
  );
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeBase64Cofre(value: string): Uint8Array {
  return base64ToBytes(value);
}
