// Manual Webmotors: erro 21|9 para imagens acima de 500 Kbytes.
const DEFAULT_MAX_BYTES = 500 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized);
}

export function assertSafeWebmotorsPhotoUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL de foto inválida.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("A foto precisa usar uma URL HTTPS pública.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
    isPrivateIpv4(hostname) || isPrivateIpv6(hostname)
  ) {
    throw new Error("A URL da foto não pode apontar para uma rede privada.");
  }
  return parsed;
}

async function assertPublicDns(hostname: string): Promise<void> {
  const results = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);
  const addresses = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  if (!addresses.length) {
    throw new Error("Não foi possível validar o endereço público da foto.");
  }
  if (addresses.some((ip) => isPrivateIpv4(ip) || isPrivateIpv6(ip))) {
    throw new Error("A URL da foto não pode apontar para uma rede privada.");
  }
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    throw new Error("Foto excede o tamanho máximo para envio à Webmotors.");
  }
  if (!response.body) throw new Error("A foto pública retornou sem conteúdo.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Foto excede o tamanho máximo para envio à Webmotors.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function fetchPublicImageAsBase64(
  url: string,
  opts?: { maxBytes?: number; timeoutMs?: number },
): Promise<string> {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let currentUrl = assertSafeWebmotorsPhotoUrl(url);
    let res: Response | null = null;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      await assertPublicDns(currentUrl.hostname);
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const location = res.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("A foto pública excedeu o limite de redirecionamentos.");
      }
      currentUrl = assertSafeWebmotorsPhotoUrl(
        new URL(location, currentUrl).toString(),
      );
    }
    if (!res) throw new Error("Falha ao baixar foto pública.");
    if (!res.ok) throw new Error("Falha ao baixar foto pública.");
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error("A URL informada não retornou uma imagem.");
    }
    const buf = await readLimitedBody(res, maxBytes);
    let binary = "";
    for (const byte of buf) binary += String.fromCharCode(byte);
    return btoa(binary);
  } finally {
    clearTimeout(timer);
  }
}
