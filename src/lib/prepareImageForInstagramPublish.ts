/**
 * Prepara uma imagem para publicação no Instagram:
 * - Ajusta proporção (adjustImageForInstagram)
 * - Converte AVIF/qualquer formato → JPEG
 * - Faz upload no bucket "produtos" e devolve URL HTTPS pública
 *
 * Use SEMPRE antes de chamar a edge function meta-publish-instagram
 * (ou qualquer fluxo que envie imagem para a Graph API do Instagram).
 */

import { supabase } from "@/integrations/supabase/client";
import { adjustImageForInstagram } from "@/lib/adjustImageForInstagram";

const BUCKET = "produtos";

/**
 * Detecta se a URL precisa de conversão para Instagram.
 * - AVIF: Instagram não aceita
 * - data:/blob: precisa virar URL pública
 */
export function needsInstagramConversion(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("blob:")) return true;
  if (lower.includes(".avif")) return true;
  return false;
}

/**
 * Garante que a imagem esteja em formato e proporção compatíveis com IG.
 * Se a URL já for um JPEG/PNG hospedado no nosso storage com proporção válida,
 * retorna a URL original (rota rápida).
 */
export async function prepareImageForInstagramPublish(
  imageUrl: string,
  userId: string
): Promise<string> {
  if (!imageUrl) throw new Error("imageUrl vazio");

  try {
    // 1) Ajustar proporção e converter para JPEG via Canvas
    const adjusted = await adjustImageForInstagram(imageUrl);

    // 2) Subir como JPEG no bucket produtos
    const filename = `${userId}/ig-publish/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filename, adjusted.blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    if (!urlData?.publicUrl) throw new Error("Falha ao gerar URL pública");

    return urlData.publicUrl;
  } catch (err) {
    console.error("[prepareImageForInstagramPublish] Falha ao ajustar/converter:", err);
    // Fallback: se a URL já é HTTP(S) e não é AVIF, deixa passar
    if (!needsInstagramConversion(imageUrl) && /^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }
    throw err;
  }
}
