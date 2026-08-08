/**
 * render-carousel-slides
 *
 * Renderiza os cards do carrossel NO SERVIDOR (sem navegador), para que o fluxo
 * possa ser disparado pelo WhatsApp/JARVIS. Pipeline:
 *   Satori (árvore de layout → SVG)  →  resvg-wasm (SVG → PNG)  →  Storage (URL pública)
 *
 * FASE 4A: apenas o template "dark-premium". Os outros 4 serão portados depois
 * que o fluxo provar valor ponta a ponta.
 *
 * Body:
 * {
 *   user_id: string,                 // obrigatório (multi-tenant, isola pasta no storage)
 *   slides: [{ type, title, body?, number? }],
 *   template?: "dark-premium",
 *   primaryColor?: string,           // #RRGGBB
 *   secondaryColor?: string,         // #RRGGBB
 *   businessName?: string,
 *   profileHandle?: string,
 *   ctaLabel?: string,
 *   incluir_logo?: boolean           // default true (usa a logo do próprio tenant)
 * }
 *
 * Resposta: { success: true, image_urls: string[], count, template }
 */

import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildDarkPremiumSlide,
  CARD_HEIGHT,
  CARD_WIDTH,
  type RenderContext,
  type RenderSlide,
} from "../_shared/carousel-templates/darkPremium.ts";
import { getTenantLogoDataUrl } from "../_shared/tenant-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "carousels";
const MAX_SLIDES = 10;

const FONT_URLS: Array<{ weight: number; url: string }> = [
  { weight: 400, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.woff" },
  { weight: 500, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-500-normal.woff" },
  { weight: 700, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff" },
  { weight: 800, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-800-normal.woff" },
  { weight: 900, url: "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-900-normal.woff" },
];

// Caches de módulo: fontes e WASM sobrevivem entre invocações do mesmo isolate.
let fontsCache: Array<{ name: string; weight: number; style: "normal"; data: ArrayBuffer }> | null = null;
let wasmReady: Promise<void> | null = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;
  const loaded = await Promise.all(
    FONT_URLS.map(async ({ weight, url }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao baixar fonte ${weight} (${res.status})`);
      return { name: "Inter", weight, style: "normal" as const, data: await res.arrayBuffer() };
    }),
  );
  fontsCache = loaded;
  return loaded;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      user_id,
      slides,
      template = "dark-premium",
      businessName,
      profileHandle,
      ctaLabel,
      incluir_logo = true,
    } = body ?? {};

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(slides) || slides.length === 0) {
      return new Response(JSON.stringify({ error: "slides é obrigatório (array não vazio)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (template !== "dark-premium") {
      return new Response(
        JSON.stringify({
          error: `Template "${template}" ainda não está disponível no render server-side. Use "dark-premium".`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const primaryColor = normalizeHex(body?.primaryColor, "#6366F1");
    const secondaryColor = normalizeHex(body?.secondaryColor, "#8B5CF6");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Logo do PRÓPRIO tenant (sem fallback cross-tenant; helper já garante isolamento)
    let logoDataUrl: string | null = null;
    if (incluir_logo) {
      try {
        logoDataUrl = await getTenantLogoDataUrl(supabase, user_id);
      } catch (err) {
        console.warn("[render-carousel-slides] logo indisponível:", err);
      }
    }

    const list: RenderSlide[] = slides.slice(0, MAX_SLIDES).map((s: any, i: number) => ({
      type: (s?.type === "cover" || s?.type === "cta" ? s.type : "content") as RenderSlide["type"],
      title: String(s?.title ?? "").slice(0, 160),
      body: s?.body ? String(s.body).slice(0, 900) : undefined,
      number: typeof s?.number === "number" ? s.number : i,
    }));

    const ctx: RenderContext = {
      primaryColor,
      secondaryColor,
      totalSlides: list.length,
      logoDataUrl,
      businessName: businessName ?? null,
      profileHandle: profileHandle ?? null,
      ctaLabel: ctaLabel ?? null,
    };

    const [fonts] = await Promise.all([loadFonts(), ensureWasm()]);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const imageUrls: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const tree = buildDarkPremiumSlide(list[i], ctx);
      const svg = await satori(tree as any, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: fonts as any,
      });
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: CARD_WIDTH },
      }).render().asPng();

      const path = `${user_id}/${stamp}/slide-${String(i + 1).padStart(2, "0")}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(`Falha ao subir slide ${i + 1}: ${upErr.message}`);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error(`Falha ao gerar URL pública do slide ${i + 1}`);
      imageUrls.push(data.publicUrl);
      console.log(`✅ [render-carousel-slides] slide ${i + 1}/${list.length} (${png.length} bytes)`);
    }

    return new Response(
      JSON.stringify({ success: true, image_urls: imageUrls, count: imageUrls.length, template }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[render-carousel-slides] erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
