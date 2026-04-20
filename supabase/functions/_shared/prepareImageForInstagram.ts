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
 * Se a imagem JÁ é HTTP(S) JPEG/PNG e está dentro do aspect ratio aceito,
 * retorna a URL original (rota rápida).
 */

import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "produtos";
const IG_MIN_RATIO = 0.8; // 4:5 retrato
const IG_MAX_RATIO = 1.91; // 1.91:1 paisagem
const TARGET_SIZE = 1080;

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
  if (!isHttpUrl(imageUrl)) throw new Error(`URL inválida: ${imageUrl.slice(0, 60)}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1) Baixar imagem
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Falha ao baixar imagem (${resp.status})`);
  const contentType = resp.headers.get("content-type") || "";
  const bytes = new Uint8Array(await resp.arrayBuffer());

  const isAvif = isAvifUrl(imageUrl) || contentType.includes("avif");

  // 2) Decodificar. AVIF não é suportado pelo imagescript → tenta via re-fetch com Accept que força fallback do CDN
  let decoded: Image;
  try {
    if (isAvif) {
      // Shopee CDN: substituir extensão .avif por .jpg força entrega em JPEG
      const jpegUrl = imageUrl.replace(/\.avif(\?|$)/i, ".jpg$1");
      console.log(`[prepareImageForInstagram] AVIF detectado, tentando JPEG: ${jpegUrl.slice(0, 100)}`);
      const jpegResp = await fetch(jpegUrl);
      if (!jpegResp.ok) throw new Error(`Fallback JPEG falhou (${jpegResp.status})`);
      const jpegBytes = new Uint8Array(await jpegResp.arrayBuffer());
      decoded = (await decode(jpegBytes)) as Image;
    } else {
      decoded = (await decode(bytes)) as Image;
    }
  } catch (err) {
    throw new Error(
      `Falha ao decodificar imagem: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const w = decoded.width;
  const h = decoded.height;
  const ratio = w / h;
  const ratioOk = ratio >= IG_MIN_RATIO && ratio <= IG_MAX_RATIO;

  let finalImage: Image = decoded;
  let didResize = false;

  // 3) Se aspect ratio fora do range → centralizar em canvas 1080x1080 branco
  if (!ratioOk) {
    didResize = true;
    // Escalar mantendo proporção pra caber em 1080x1080
    const scale = Math.min(TARGET_SIZE / w, TARGET_SIZE / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);
    decoded.resize(newW, newH);

    const canvas = new Image(TARGET_SIZE, TARGET_SIZE);
    canvas.fill(0xffffffff); // branco (RGBA: 255,255,255,255)
    const ox = Math.floor((TARGET_SIZE - newW) / 2);
    const oy = Math.floor((TARGET_SIZE - newH) / 2);
    canvas.composite(decoded, ox, oy);
    finalImage = canvas;
  }

  // 4) Encode JPEG
  const jpegBuffer = await finalImage.encodeJPEG(90);

  // 5) Upload no bucket
  const filename = `${userId}/ig-publish/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, jpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Falha upload: ${upErr.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!urlData?.publicUrl) throw new Error("Falha ao gerar URL pública");

  return {
    url: urlData.publicUrl,
    converted: true,
    reason: isAvif
      ? didResize
        ? "avif+aspect"
        : "avif"
      : didResize
      ? "aspect"
      : "reencode",
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
    return await prepareImageForInstagram(imageUrl, userId, supabaseUrl, serviceRoleKey);
  } catch (err) {
    console.warn(
      `[prepareImageForInstagramSafe] Falha (mantendo URL original): ${err instanceof Error ? err.message : err}`,
    );
    return {
      url: imageUrl,
      converted: false,
      reason: `error:${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
