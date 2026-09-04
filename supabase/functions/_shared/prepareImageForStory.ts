/**
 * Helper compartilhado: prepara uma imagem para Story do Instagram (9:16).
 *
 * O Instagram ESTICA qualquer imagem que não seja 9:16 no Story.
 * Aqui a imagem é encaixada inteira (contain) num canvas 1080x1920,
 * com o fundo na cor média da própria foto — nada de deformação.
 *
 * Retorna sempre uma URL pública JPEG. Em caso de falha, use o wrapper Safe.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Image = any;

async function loadImagescript() {
  const mod = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");
  return { decode: mod.decode, Image: mod.Image };
}

const BUCKET = "produtos";
const STORY_W = 1080;
const STORY_H = 1920;
const STORY_RATIO = STORY_W / STORY_H; // 0.5625
const TOLERANCIA = 0.02;

interface PrepareResult {
  url: string;
  converted: boolean;
  reason?: string;
}

function corMedia(img: Image): number {
  let r = 0, g = 0, b = 0, n = 0;
  const passo = Math.max(1, Math.floor(Math.min(img.width, img.height) / 40));
  for (let y = 1; y <= img.height; y += passo) {
    for (let x = 1; x <= img.width; x += passo) {
      const px = img.getPixelAt(x, y);
      r += (px >> 24) & 0xff;
      g += (px >> 16) & 0xff;
      b += (px >> 8) & 0xff;
      n++;
    }
  }
  if (!n) return 0x000000ff;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v / n)));
  return ((m(r) << 24) | (m(g) << 16) | (m(b) << 8) | 0xff) >>> 0;
}

export async function prepareImageForStory(
  imageUrl: string,
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<PrepareResult> {
  if (!imageUrl) throw new Error("imageUrl vazio");
  if (!/^https?:\/\//i.test(imageUrl)) throw new Error("URL inválida para Story");

  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Falha ao baixar imagem (${resp.status})`);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  const { decode, Image } = await loadImagescript();
  const decoded = (await decode(bytes)) as Image;

  const w = decoded.width;
  const h = decoded.height;
  const ratio = w / h;

  // Já é 9:16 (com folga mínima) → publica direto
  if (Math.abs(ratio - STORY_RATIO) <= TOLERANCIA) {
    return { url: imageUrl, converted: false, reason: "já 9:16" };
  }

  const fundo = corMedia(decoded);
  const escala = Math.min(STORY_W / w, STORY_H / h);
  const novoW = Math.max(1, Math.round(w * escala));
  const novoH = Math.max(1, Math.round(h * escala));
  decoded.resize(novoW, novoH);

  const canvas = new Image(STORY_W, STORY_H);
  canvas.fill(fundo);
  canvas.composite(decoded, Math.floor((STORY_W - novoW) / 2), Math.floor((STORY_H - novoH) / 2));

  const jpeg = await canvas.encodeJPEG(90);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const filename = `${userId}/ig-story/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, jpeg, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(`Falha upload story: ${upErr.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!data?.publicUrl) throw new Error("Falha ao gerar URL pública do story");

  return { url: data.publicUrl, converted: true, reason: `contain ${w}x${h}` };
}

export async function prepareImageForStorySafe(
  imageUrl: string,
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<PrepareResult> {
  try {
    return await prepareImageForStory(imageUrl, userId, supabaseUrl, serviceRoleKey);
  } catch (err) {
    console.warn(
      `[prepareImageForStorySafe] falha (mantendo original): ${err instanceof Error ? err.message : err}`,
    );
    return { url: imageUrl, converted: false, reason: "erro" };
  }
}
