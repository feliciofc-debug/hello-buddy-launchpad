/**
 * Helper compartilhado: prepara uma URL de imagem para publicação no Instagram.
 *
 * Instagram REJEITA:
 *  - AVIF (formato Shopee). Erro: "Only photo or video can be accepted as media type"
 *  - Aspect ratio fora de 4:5 (0.8) a 1.91:1 (1.91). Erro: "The aspect ratio is not supported"
 *
 * Estratégia:
 *  1) Baixa a imagem original
 *  2) Decodifica (PNG/JPEG/WebP/GIF nativos do imagescript). AVIF entra em fallback abaixo.
 *  3) Se aspect ratio inválido → redimensiona pra 1080x1080 com letterbox branco (cover quadrado)
 *  4) Reencode em JPEG quality 90
 *  5) Upload no bucket `produtos/ig-publish/{userId}/{ts}-{rand}.jpg`
 *  6) Retorna URL pública
 *
 * Toda imagem é reencodada: a Graph API de publicação do Instagram recebe
 * sempre uma URL pública nossa com JPEG sRGB.
 */

// IMPORTANTE: imagescript é carregado via import DINÂMICO (dentro da função).
// O import estático baixa/descomprime WASM no boot e, quando o CDN falha
// ("brotli error"), derruba a Edge Function inteira antes de qualquer código rodar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Image = any;

async function loadImagescript() {
  const mod = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
  return { decode: mod.decode, Image: mod.Image };
}

const BUCKET = "produtos";
const IG_MIN_RATIO = 0.8; // 4:5 retrato
const IG_MAX_RATIO = 1.91; // 1.91:1 paisagem
const TARGET_SIZE = 1080;
const MIN_SIDE = 320;
const MAX_SIDE = 2160;
const MAX_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_IMAGE_MIME = "image/jpeg";

export function instagramImageStoragePath(
  userId: string,
  now = Date.now(),
  random = Math.random().toString(36).slice(2, 10),
): string {
  return `${userId}/ig-publish/${now}-${random}.jpg`;
}

export function isAvifUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes(".avif");
}

export function isHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

interface PrepareResult {
  url: string;
  converted: boolean;
  reason?: string;
}

export type PreparedInstagramImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  framed: boolean;
};

export async function normalizeInstagramImageBytes(
  bytes: Uint8Array,
): Promise<PreparedInstagramImage> {
  const { decode, Image } = await loadImagescript();
  const decoded = (await decode(bytes)) as Image;
  const sourceWidth = decoded.width;
  const sourceHeight = decoded.height;
  if (!sourceWidth || !sourceHeight) throw new Error("imagem sem dimensões");

  const ratio = sourceWidth / sourceHeight;
  const framed = ratio < IG_MIN_RATIO || ratio > IG_MAX_RATIO;
  let targetWidth: number;
  let targetHeight: number;
  if (framed) {
    targetWidth = TARGET_SIZE;
    targetHeight = TARGET_SIZE;
  } else {
    const fit = Math.min(
      1,
      MAX_SIDE / Math.max(sourceWidth, sourceHeight),
    );
    const upscale = Math.max(
      1,
      MIN_SIDE / Math.min(sourceWidth, sourceHeight),
    );
    const scale = Math.min(
      MAX_SIDE / Math.max(sourceWidth, sourceHeight),
      Math.max(fit, upscale),
    );
    targetWidth = Math.max(MIN_SIDE, Math.round(sourceWidth * scale));
    targetHeight = Math.max(MIN_SIDE, Math.round(sourceHeight * scale));
  }

  const containScale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const imageWidth = Math.max(1, Math.round(sourceWidth * containScale));
  const imageHeight = Math.max(1, Math.round(sourceHeight * containScale));
  decoded.resize(imageWidth, imageHeight);
  let canvas = new Image(targetWidth, targetHeight);
  canvas.fill(0xffffffff);
  canvas.composite(
    decoded,
    Math.floor((targetWidth - imageWidth) / 2),
    Math.floor((targetHeight - imageHeight) / 2),
  );
  let jpeg = new Uint8Array(await canvas.encodeJPEG(90));
  while (
    jpeg.byteLength > MAX_BYTES &&
    canvas.width > MIN_SIDE &&
    canvas.height > MIN_SIDE
  ) {
    const nextWidth = Math.max(MIN_SIDE, Math.floor(canvas.width * 0.85));
    const nextHeight = Math.max(MIN_SIDE, Math.floor(canvas.height * 0.85));
    canvas = canvas.resize(nextWidth, nextHeight);
    jpeg = new Uint8Array(await canvas.encodeJPEG(90));
  }
  if (jpeg.byteLength > MAX_BYTES) {
    throw new Error("imagem JPEG excede 8 MB");
  }
  return {
    bytes: jpeg,
    width: canvas.width,
    height: canvas.height,
    sourceWidth,
    sourceHeight,
    framed,
  };
}

export async function normalizeInstagramImageFromUrl(
  imageUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PreparedInstagramImage> {
  const response = await fetcher(imageUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem (${response.status})`);
  }
  const sourceBytes = new Uint8Array(await response.arrayBuffer());
  try {
    return await normalizeInstagramImageBytes(sourceBytes);
  } catch {
    const proxy = `https://wsrv.nl/?url=${
      encodeURIComponent(imageUrl)
    }&output=jpg&q=90`;
    const converted = await fetcher(proxy);
    if (!converted.ok) {
      throw new Error("Não consegui converter a imagem para JPEG.");
    }
    return await normalizeInstagramImageBytes(
      new Uint8Array(await converted.arrayBuffer()),
    );
  }
}

/**
 * Prepara a imagem pro Instagram. Sempre retorna uma URL pública JPEG válida.
 * Em caso de falha, lança erro — o caller decide se pula o post ou usa imagem original.
 */
export async function prepareImageForInstagram(
  imageUrl: string,
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<PrepareResult> {
  if (!imageUrl) throw new Error("imageUrl vazio");
  if (!isHttpUrl(imageUrl)) {
    throw new Error(`URL inválida: ${imageUrl.slice(0, 60)}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const isAvif = isAvifUrl(imageUrl);
  const normalized = await normalizeInstagramImageFromUrl(imageUrl);

  // 5) Upload no bucket
  const filename = instagramImageStoragePath(userId);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, normalized.bytes, {
      contentType: INSTAGRAM_IMAGE_MIME,
      upsert: true,
    });
  if (upErr) throw new Error(`Falha upload: ${upErr.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(
    filename,
  );
  if (!urlData?.publicUrl) throw new Error("Falha ao gerar URL pública");

  return {
    url: urlData.publicUrl,
    converted: true,
    reason: `${isAvif ? "avif+" : ""}${
      normalized.framed ? "frame+" : ""
    }jpeg-${normalized.width}x${normalized.height}`,
  };
}

/**
 * Wrapper resiliente: tenta preparar a imagem, se falhar retorna a URL original
 * com flag `converted=false` pra que o caller decida (no Autopilot deixamos passar
 * a URL original — o pior caso é o post falhar igual ao comportamento anterior).
 */
export async function prepareImageForInstagramSafe(
  imageUrl: string,
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<PrepareResult> {
  try {
    return await prepareImageForInstagram(
      imageUrl,
      userId,
      supabaseUrl,
      serviceRoleKey,
    );
  } catch (err) {
    console.warn(
      `[prepareImageForInstagramSafe] Falha (mantendo URL original): ${
        err instanceof Error ? err.message : err
      }`,
    );
    return {
      url: imageUrl,
      converted: false,
      reason: `error:${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
