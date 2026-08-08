// ============================================================
// media-para-meta — proxy de conversão de imagem para JPEG.
//
// GET /functions/v1/media-para-meta?url=<url-da-imagem>
//
// - Se a origem já é image/jpeg ou image/png → repassa o binário original.
// - Se é AVIF/WEBP/HEIC/etc → converte para JPEG (ImageMagick WASM).
// - Cache: grava o JPEG no bucket público `meta-media-cache` (chave = hash da
//   URL) e, em hits futuros, redireciona direto para o CDN (custo ~zero).
//
// Público (verify_jwt = false) porque a Meta baixa a imagem anonimamente.
// Multi-tenant por natureza: não depende de user_id, serve qualquer catálogo.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "https://deno.land/x/imagemagick_deno@0.0.26/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "meta-media-cache";
const SAFE_TYPES = ["image/jpeg", "image/png"];

let magickReady = false;
async function ensureMagick() {
  if (!magickReady) {
    await initializeImageMagick();
    magickReady = true;
  }
}

async function sha1(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const reqUrl = new URL(req.url);
  const src = reqUrl.searchParams.get("url");
  // ig=1 → normaliza para 1080x1080 (aspect ratio sempre aceito pelo Instagram),
  // com preenchimento branco nas bordas (sem cortar o conteúdo).
  const igMode = reqUrl.searchParams.get("ig") === "1";
  if (!src || !/^https?:\/\//i.test(src)) {
    return new Response("url inválida", { status: 400, headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const key = `${await sha1(igMode ? `ig1:${src}` : src)}.jpg`;


  // 1) Cache hit → serve o JPEG já convertido (bucket privado, servido pela função)
  try {
    const { data: cached } = await admin.storage.from(BUCKET).download(key);
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer());
      return new Response(bytes, {
        headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" },
      });
    }
  } catch { /* segue para conversão */ }


  // 2) Baixa a origem
  let originBytes: Uint8Array;
  let originType = "";
  try {
    const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return new Response("origem indisponível", { status: 502, headers: CORS });
    originType = (r.headers.get("content-type") || "").toLowerCase().split(";")[0];
    originBytes = new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    console.error("[media-para-meta] download falhou:", (e as Error).message);
    return new Response("falha ao baixar origem", { status: 502, headers: CORS });
  }

  // 3) Já é aceito pela Meta → repassa (exceto no modo Instagram, que precisa
  //    de normalização de aspect ratio mesmo quando já é JPEG/PNG)
  if (!igMode && SAFE_TYPES.includes(originType)) {
    return new Response(originBytes, {
      headers: { ...CORS, "Content-Type": originType, "Cache-Control": "public, max-age=31536000" },
    });
  }

  // 4) Converte para JPEG.
  //    ImageMagick WASM NÃO decodifica AVIF (formato das imagens da Shopee),
  //    então o decoder primário é o wsrv.nl (gratuito, alta disponibilidade) e
  //    o ImageMagick fica como fallback para WEBP/BMP/TIFF/GIF.
  let jpeg: Uint8Array | null = null;

  try {
    const semProto = src.replace(/^https?:\/\//i, "");
    const params = igMode
      ? "output=jpg&q=88&w=1080&h=1080&fit=contain&cbg=white&we"
      : "output=jpg&q=88&w=1600&h=1600&fit=inside&we";
    const w = await fetch(
      `https://wsrv.nl/?url=${encodeURIComponent(semProto)}&${params}`,
    );

    const wType = (w.headers.get("content-type") || "").toLowerCase();
    if (w.ok && wType.includes("image/jpeg")) {
      jpeg = new Uint8Array(await w.arrayBuffer());
    }
  } catch (e) {
    console.warn("[media-para-meta] wsrv falhou:", (e as Error).message);
  }

  if (!jpeg) {
    try {
      await ensureMagick();
      jpeg = await new Promise<Uint8Array>((resolve) => {
        ImageMagick.read(originBytes, (img) => {
          img.quality = 88;
          if (igMode) {
            // Normaliza para 1080x1080 sem cortar (contain + fundo branco)
            const scale = Math.min(1080 / img.width, 1080 / img.height);
            img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
            try {
              img.backgroundColor = "#FFFFFF" as unknown as never;
              img.extent(1080, 1080);
            } catch { /* se extent não estiver disponível, segue redimensionado */ }
          } else if (img.width > 1600 || img.height > 1600) {
            // WhatsApp recomenda até ~1600px no maior lado; evita payload gigante.
            const scale = 1600 / Math.max(img.width, img.height);
            img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
          }
          img.write(MagickFormat.Jpeg, (data) => resolve(new Uint8Array(data)));
        });
      });

    } catch (e) {
      console.error("[media-para-meta] conversão falhou:", (e as Error).message);
      return new Response("falha ao converter imagem", { status: 502, headers: CORS });
    }
  }


  // 5) Cacheia (best-effort) e devolve
  try {
    await admin.storage.from(BUCKET).upload(key, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
    });
  } catch (e) {
    console.warn("[media-para-meta] cache falhou:", (e as Error).message);
  }

  return new Response(jpeg, {
    headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" },
  });
});
