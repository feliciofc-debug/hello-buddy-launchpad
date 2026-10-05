/**
 * render-anuncio-produto
 *
 * Renderiza um ANÚNCIO DE PRODUTO (foto + ficha técnica + preço + logo do tenant)
 * no servidor, sem navegador: Satori (layout → SVG) → resvg-wasm (SVG → PNG) → Storage.
 *
 * A IA nunca escreve texto na imagem: preço, itens, telefone e logo são camadas
 * de template — texto exato, logo idêntica à cadastrada pelo tenant.
 *
 * Body:
 * {
 *   user_id: string,                     // obrigatório (multi-tenant)
 *   titulo: string,                      // ex: "HYUNDAI CRETA 1.0 TURBO"
 *   subtitulo?: string,                  // ex: "AUTOMÁTICO 2023/2023"
 *   itens?: [{ texto, rotulo? }] | string[],
 *   ano?: string,
 *   preco?: string, preco_label?: string,
 *   preco_referencia?: string, preco_referencia_label?: string,
 *   preco_referencia_obs?: string,
 *   badge?: string,                      // ex: "PINTURA 100% ORIGINAL"
 *   telefone?: string, instagram?: string, site?: string,
 *   business_name?: string,
 *   foto_url?: string,                   // foto do produto (http/https)
 *   foto_base64?: string,                // alternativa (data URL ou base64 puro)
 *   formato?: "feed" | "story",          // default feed (1080x1080)
 *   primary_color?: string, accent_color?: string,
 *   incluir_logo?: boolean,              // default true
 *   logo_path?: string,                  // logo de cliente no bucket tenant-logos
 *   logo_source?: "tenant" | "client"   // client nunca cai no fallback do tenant
 * }
 *
 * Resposta: { success: true, image_url, formato, width, height }
 */

import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AnuncioData,
  type AnuncioFormato,
  type AnuncioItem,
  anuncioSize,
  buildAnuncio,
} from "../_shared/anuncio-templates/darkGold.ts";
import { selectAnuncioPhoto } from "../_shared/anuncio-photo.ts";
import {
  normalizeImageDataUrl,
  renderableImageDataUrl,
} from "../_shared/renderable-image.ts";
import { getTenantLogoDataUrl } from "../_shared/tenant-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "produtos";

const FONT_URLS: Array<{ weight: number; url: string }> = [
  { weight: 400, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.woff" },
  { weight: 700, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff" },
  { weight: 900, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-900-normal.woff" },
];

let fontsCache: Array<{ name: string; weight: number; style: "normal"; data: ArrayBuffer }> | null = null;
let wasmReady: Promise<void> | null = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;
  fontsCache = await Promise.all(
    FONT_URLS.map(async ({ weight, url }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao baixar fonte ${weight} (${res.status})`);
      return { name: "Inter", weight, style: "normal" as const, data: await res.arrayBuffer() };
    }),
  );
  return fontsCache;
}

function ensureWasm() {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
    ).catch((err) => {
      wasmReady = null;
      throw err;
    });
  }
  return wasmReady;
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : fallback;
}

/** Satori só aceita imagem embutida de forma confiável → tudo vira data URL. */
async function fotoParaDataUrl(fotoUrl?: string, fotoBase64?: string): Promise<string | null> {
  const logInvalid = (message: string) =>
    console.warn(`[render-anuncio-produto] ${message}`);
  if (fotoBase64) {
    return await normalizeImageDataUrl(
      fotoBase64.startsWith("data:")
        ? fotoBase64
        : `data:image/jpeg;base64,${fotoBase64}`,
      "foto",
      logInvalid,
    );
  }
  if (!fotoUrl || !/^https?:\/\//i.test(fotoUrl)) return null;
  try {
    const res = await fetch(fotoUrl, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`foto ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return null;
    return await renderableImageDataUrl(buf, "foto", logInvalid);
  } catch (e) {
    console.warn("[render-anuncio-produto] foto indisponível:", (e as Error).message);
    return null;
  }
}

async function fotoComFallbackParaDataUrl(
  fotoUrl?: string,
  fotoBase64?: string,
  fotoOriginalUrl?: string,
): Promise<{ dataUrl: string | null; source: "improved" | "original" | "none" }> {
  if (fotoBase64) {
    const embedded = await fotoParaDataUrl(undefined, fotoBase64);
    if (embedded) return { dataUrl: embedded, source: "improved" };
  }
  const selected = await selectAnuncioPhoto({
    preferred: fotoUrl,
    original: fotoOriginalUrl,
    load: (url) => fotoParaDataUrl(url, undefined),
  });
  return { dataUrl: selected.value, source: selected.source };
}

async function logoPathParaDataUrl(
  supabase: any,
  userId: string,
  rawPath: unknown,
): Promise<string | null> {
  const path = String(rawPath ?? "");
  if (!path || !path.startsWith(`${userId}/`)) return null;
  const { data, error } = await supabase.storage.from("tenant-logos").download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!bytes.length) return null;
  return await renderableImageDataUrl(
    bytes,
    "logo",
    (message) => console.warn(`[render-anuncio-produto] ${message}`),
  );
}

function normalizeItens(raw: unknown): AnuncioItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i: any): AnuncioItem | null => {
      if (typeof i === "string") {
        const t = i.trim();
        return t ? { texto: t.slice(0, 42) } : null;
      }
      const texto = String(i?.texto ?? i?.valor ?? "").trim();
      if (!texto) return null;
      const rotulo = String(i?.rotulo ?? i?.label ?? "").trim();
      return { texto: texto.slice(0, 42), rotulo: rotulo ? rotulo.slice(0, 28) : undefined };
    })
    .filter((i): i is AnuncioItem => !!i)
    .slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const user_id = body?.user_id;
    const titulo = String(body?.titulo ?? "").trim();

    if (!user_id) {
      return new Response(JSON.stringify({ success: false, error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (titulo.length < 2) {
      return new Response(JSON.stringify({ success: false, error: "titulo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formato: AnuncioFormato = body?.formato === "story" ? "story" : "feed";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let logoDataUrl: string | null = null;
    if (body?.incluir_logo !== false) {
      try {
        const rawLogoDataUrl = body?.logo_path
          ? await logoPathParaDataUrl(supabase, user_id, body.logo_path)
          : body?.logo_source === "client"
          ? null
          : await getTenantLogoDataUrl(supabase, user_id);
        logoDataUrl = rawLogoDataUrl
          ? await normalizeImageDataUrl(
            rawLogoDataUrl,
            "logo",
            (message) => console.warn(`[render-anuncio-produto] ${message}`),
          )
          : null;
      } catch (e) {
        console.warn("[render-anuncio-produto] logo indisponível:", (e as Error).message);
      }
    }

    const [fotoResult, fonts] = await Promise.all([
      fotoComFallbackParaDataUrl(
        body?.foto_url,
        body?.foto_base64,
        body?.foto_url_original,
      ),
      loadFonts(),
      ensureWasm(),
    ]);
    const fotoDataUrl = fotoResult.dataUrl;
    if (!fotoDataUrl) {
      console.error("[render-anuncio-produto] foto inválida: melhorada e original indisponíveis");
      return new Response(
        JSON.stringify({
          success: false,
          error: "foto inválida; envie novamente a foto original",
          foto_source: "none",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data: AnuncioData = {
      titulo,
      subtitulo: body?.subtitulo ? String(body.subtitulo).slice(0, 60) : null,
      itens: normalizeItens(body?.itens),
      ano: body?.ano ? String(body.ano).slice(0, 16) : null,
      preco: body?.preco ? String(body.preco).slice(0, 24) : null,
      precoLabel: body?.preco_label ? String(body.preco_label).slice(0, 24) : null,
      precoReferencia: body?.preco_referencia ? String(body.preco_referencia).slice(0, 24) : null,
      precoReferenciaLabel: body?.preco_referencia_label
        ? String(body.preco_referencia_label).slice(0, 18)
        : null,
      precoReferenciaObs: body?.preco_referencia_obs
        ? String(body.preco_referencia_obs).slice(0, 30)
        : null,
      badge: body?.badge ? String(body.badge).slice(0, 34) : null,
      telefone: body?.telefone ? String(body.telefone).slice(0, 24) : null,
      instagram: body?.instagram ? String(body.instagram).slice(0, 30) : null,
      site: body?.site ? String(body.site).slice(0, 30) : null,
      businessName: body?.business_name ? String(body.business_name).slice(0, 40) : null,
      fotoDataUrl,
      logoDataUrl,
      primaryColor: normalizeHex(body?.primary_color, "#8A6A12"),
      accentColor: normalizeHex(body?.accent_color, "#E8B93B"),
      formato,
    };

    const { width, height } = anuncioSize(formato);
    const svg = await satori(buildAnuncio(data) as any, { width, height, fonts: fonts as any });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();

    const path = `anuncios/${user_id}/anuncio-${formato}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`Falha ao subir anúncio: ${upErr.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error("Falha ao gerar URL pública do anúncio");

    console.log(
      `✅ [render-anuncio-produto] ${formato} ${png.length} bytes — logo=${!!logoDataUrl} foto=${!!fotoDataUrl} foto_source=${fotoResult.source}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        image_url: pub.publicUrl,
        formato,
        width,
        height,
        logo_aplicada: !!logoDataUrl,
        foto_aplicada: !!fotoDataUrl,
        foto_source: fotoResult.source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[render-anuncio-produto] erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
