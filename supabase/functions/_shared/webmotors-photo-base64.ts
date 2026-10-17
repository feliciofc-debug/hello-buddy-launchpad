const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchPublicImageAsBase64(
  url: string,
  opts?: { maxBytes?: number; timeoutMs?: number },
): Promise<string> {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Falha ao baixar foto pública.");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new Error("Foto excede o tamanho máximo para envio à Webmotors.");
    }
    let binary = "";
    for (const byte of buf) binary += String.fromCharCode(byte);
    return btoa(binary);
  } finally {
    clearTimeout(timer);
  }
}
