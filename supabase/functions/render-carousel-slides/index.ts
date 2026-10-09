/**
 * render-carousel-slides
 *
 * Renderiza os cards do carrossel NO SERVIDOR (sem navegador), para que o fluxo
 * possa ser disparado pelo WhatsApp/JARVIS. Pipeline:
 *   Satori (árvore de layout → SVG)  →  resvg-wasm (SVG → PNG)  →  Storage (URL pública)
 *
 * Templates de marketing disponíveis: dark-premium, clean-bright,
 * gradient-vibrant, elegant-serif e neon-tech. O carrossel de veículos
 * permanece isolado no dark-premium.
 *
 * Body:
 * {
 *   user_id: string,                 // obrigatório (multi-tenant, isola pasta no storage)
 *   slides: [{ type, title, body?, number? }],
 *   template?: "dark-premium" | "clean-bright" | "gradient-vibrant"
 *     | "elegant-serif" | "neon-tech",
 *   backgroundColor?: string,        // #RRGGBB, opcional
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
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  buildDarkPremiumSlide,
  buildDarkPremiumVehicleSlide,
  CARD_HEIGHT,
  CARD_WIDTH,
  darkPremiumVehiclePhotoRegion,
  type RenderContext,
  type RenderSlide,
} from "../_shared/carousel-templates/darkPremium.ts";
import { buildCleanBrightSlide } from "../_shared/carousel-templates/cleanBright.ts";
import { buildGradientVibrantSlide } from "../_shared/carousel-templates/gradientVibrant.ts";
import { buildElegantSerifSlide } from "../_shared/carousel-templates/elegantSerif.ts";
import { buildNeonTechSlide } from "../_shared/carousel-templates/neonTech.ts";
import { relativeLuminance } from "../_shared/carousel-templates/shared.ts";
import {
  carouselLogoBackground,
  type CarouselTemplate,
  normalizeCarouselTemplate,
} from "../_shared/carousel-styles.ts";
import { sanitizeCarouselSlides } from "../_shared/carousel-content.ts";
import {
  calculatePhotoFrame,
  frameContainsObject,
} from "../_shared/anuncio-photo-framing.ts";
import {
  vehicleCarouselDimensions,
  type VehicleCarouselFormat,
  type VehicleCarouselSlide,
} from "../_shared/vehicle-carousel.ts";
import { renderableImageDataUrl } from "../_shared/renderable-image.ts";
import {
  getTenantLogoDataUrl,
  getTenantLogoDataUrlForBackground,
} from "../_shared/tenant-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "carousels";
const MAX_SLIDES = 10;

const FONT_URLS: Array<{ name: string; weight: number; url: string }> = [
  {
    name: "Inter",
    weight: 400,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.woff",
  },
  {
    name: "Inter",
    weight: 500,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-500-normal.woff",
  },
  {
    name: "Inter",
    weight: 700,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff",
  },
  {
    name: "Inter",
    weight: 800,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-800-normal.woff",
  },
  {
    name: "Inter",
    weight: 900,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-900-normal.woff",
  },
  {
    name: "Georgia",
    weight: 700,
    url:
      "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.18/files/playfair-display-latin-700-normal.woff",
  },
];

// Caches de módulo: fontes e WASM sobrevivem entre invocações do mesmo isolate.
let fontsCache:
  | Array<{ name: string; weight: number; style: "normal"; data: ArrayBuffer }>
  | null = null;
let wasmReady: Promise<void> | null = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;
  const loaded = await Promise.all(
    FONT_URLS.map(async ({ name, weight, url }) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Falha ao baixar fonte ${weight} (${res.status})`);
      }
      return {
        name,
        weight,
        style: "normal" as const,
        data: await res.arrayBuffer(),
      };
    }),
  );
  fontsCache = loaded;
  return loaded;
}

function ensureWasm() {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch(
        "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
      ),
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
  return /^#?[0-9a-fA-F]{6}$/.test(v)
    ? (v.startsWith("#") ? v : `#${v}`)
    : fallback;
}

function normalizeOptionalHex(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = normalizeHex(value, "");
  return normalized || null;
}

const TEMPLATE_BUILDERS: Record<
  CarouselTemplate,
  (slide: RenderSlide, context: RenderContext) => unknown
> = {
  "dark-premium": buildDarkPremiumSlide,
  "clean-bright": buildCleanBrightSlide,
  "gradient-vibrant": buildGradientVibrantSlide,
  "elegant-serif": buildElegantSerifSlide,
  "neon-tech": buildNeonTechSlide,
};

function logoBackgroundFor(
  template: CarouselTemplate,
  backgroundColor: string | null,
): "light" | "dark" {
  return carouselLogoBackground(
    template,
    backgroundColor ? relativeLuminance(backgroundColor) >= 0.5 : null,
  );
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",", 2)[1] || "";
  return Uint8Array.from(
    atob(encoded),
    (character) => character.charCodeAt(0),
  );
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`foto ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = await renderableImageDataUrl(
    bytes,
    "foto",
    (message) => console.warn(`[render-carousel-slides] ${message}`),
  );
  if (!dataUrl) throw new Error("foto do carrossel inválida");
  return dataUrl;
}

function edgeAverageColor(image: Image): number {
  const border = Math.max(
    1,
    Math.round(Math.min(image.width, image.height) * 0.04),
  );
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (
        x >= border && x < image.width - border &&
        y >= border && y < image.height - border
      ) continue;
      const offset = (y * image.width + x) * 4;
      if (image.bitmap[offset + 3] === 0) continue;
      red += image.bitmap[offset];
      green += image.bitmap[offset + 1];
      blue += image.bitmap[offset + 2];
      count++;
    }
  }
  return Image.rgbToColor(
    count ? Math.round(red / count) : 20,
    count ? Math.round(green / count) : 20,
    count ? Math.round(blue / count) : 20,
  );
}

async function composeVehiclePhoto(
  slide: VehicleCarouselSlide,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  if (!slide.photo_url) throw new Error("slide sem foto");
  const dataUrl = await imageUrlToDataUrl(slide.photo_url);
  const source = await Image.decode(dataUrlBytes(dataUrl));
  const plan = calculatePhotoFrame({
    sourceWidth: source.width,
    sourceHeight: source.height,
    targetWidth,
    targetHeight,
    fotoBox: slide.photo_box,
  });
  if (!frameContainsObject(plan, targetWidth, targetHeight)) {
    throw new Error("enquadramento cortaria o veículo");
  }
  const canvas = new Image(targetWidth, targetHeight);
  canvas.fill(edgeAverageColor(source));
  canvas.composite(
    source.resize(plan.resizedWidth, plan.resizedHeight),
    plan.x,
    plan.y,
  );
  const png = await canvas.encode();
  let binary = "";
  for (let offset = 0; offset < png.length; offset += 8192) {
    binary += String.fromCharCode(...png.subarray(offset, offset + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function logoPathDataUrl(
  supabase: any,
  userId: string,
  rawPath: unknown,
): Promise<string | null> {
  const path = String(rawPath || "");
  if (!path || !path.startsWith(`${userId}/`)) return null;
  const { data, error } = await supabase.storage.from("tenant-logos").download(
    path,
  );
  if (error || !data) return null;
  return await renderableImageDataUrl(
    new Uint8Array(await data.arrayBuffer()),
    "logo",
  );
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
      vehicle_mode = false,
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
      return new Response(
        JSON.stringify({ error: "slides é obrigatório (array não vazio)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const selectedTemplate = normalizeCarouselTemplate(template);
    if (!selectedTemplate) {
      return new Response(
        JSON.stringify({
          error: `Template "${template}" inválido.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const primaryColor = normalizeHex(body?.primaryColor, "#6366F1");
    const secondaryColor = normalizeHex(body?.secondaryColor, "#8B5CF6");
    const backgroundColor = normalizeOptionalHex(body?.backgroundColor);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Logo do PRÓPRIO tenant/cliente, sempre isolada na pasta do tenant.
    let logoDataUrl: string | null = null;
    if (incluir_logo) {
      try {
        logoDataUrl = vehicle_mode
          ? await logoPathDataUrl(supabase, user_id, body?.logo_path) ??
            await getTenantLogoDataUrlForBackground(
              supabase,
              user_id,
              "dark",
              true,
            )
          : await getTenantLogoDataUrlForBackground(
            supabase,
            user_id,
            logoBackgroundFor(selectedTemplate, backgroundColor),
            true,
          ) ?? await getTenantLogoDataUrl(supabase, user_id);
      } catch (err) {
        console.warn("[render-carousel-slides] logo indisponível:", err);
      }
    }

    if (vehicle_mode) {
      const format: VehicleCarouselFormat = body?.format === "square"
        ? "square"
        : "portrait";
      const rawSlides = slides.slice(0, MAX_SLIDES) as VehicleCarouselSlide[];
      if (
        rawSlides.some((slide) =>
          slide?.type !== "cta" &&
          (!slide?.photo_url || !/^https?:\/\//i.test(slide.photo_url))
        )
      ) {
        throw new Error("slides de foto precisam de photo_url pública");
      }
      const layout = vehicleCarouselDimensions(format);
      const [fonts] = await Promise.all([loadFonts(), ensureWasm()]);
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const imageUrls: string[] = [];
      for (let i = 0; i < rawSlides.length; i++) {
        const region = darkPremiumVehiclePhotoRegion(
          rawSlides[i].type,
          layout.width,
          layout.height,
        );
        const photoDataUrl = region
          ? await composeVehiclePhoto(
            rawSlides[i],
            region.width,
            region.height,
          )
          : null;
        const tree = buildDarkPremiumVehicleSlide(rawSlides[i], {
          width: layout.width,
          height: layout.height,
          primaryColor,
          secondaryColor,
          photoDataUrl,
          logoDataUrl,
          totalSlides: rawSlides.length,
          businessName: businessName ?? null,
          profileHandle: profileHandle ?? null,
          ctaLabel: ctaLabel ?? "CHAMAR NO WHATSAPP",
        });
        const svg = await satori(tree as any, {
          width: layout.width,
          height: layout.height,
          fonts: fonts as any,
        });
        const png = new Resvg(svg, {
          fitTo: { mode: "width", value: layout.width },
        }).render().asPng();
        const path = `${user_id}/${stamp}/slide-${
          String(i + 1).padStart(2, "0")
        }.png`;
        const { error } = await supabase.storage.from(BUCKET).upload(
          path,
          png,
          {
            contentType: "image/png",
            upsert: true,
          },
        );
        if (error) {
          throw new Error(`Falha ao subir slide ${i + 1}: ${error.message}`);
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        imageUrls.push(data.publicUrl);
      }
      return new Response(
        JSON.stringify({
          success: true,
          image_urls: imageUrls,
          count: imageUrls.length,
          template,
          format,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sanitizedSlides = sanitizeCarouselSlides(slides.slice(0, MAX_SLIDES));
    const list: RenderSlide[] = sanitizedSlides.map((s: any, i: number) => ({
      type: (s?.type === "cover" || s?.type === "cta"
        ? s.type
        : "content") as RenderSlide["type"],
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
      backgroundColor,
    };

    const [fonts] = await Promise.all([loadFonts(), ensureWasm()]);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const imageUrls: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const tree = TEMPLATE_BUILDERS[selectedTemplate](list[i], ctx);
      const svg = await satori(tree as any, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: fonts as any,
      });
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: CARD_WIDTH },
      }).render().asPng();

      const path = `${user_id}/${stamp}/slide-${
        String(i + 1).padStart(2, "0")
      }.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (upErr) {
        throw new Error(`Falha ao subir slide ${i + 1}: ${upErr.message}`);
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error(`Falha ao gerar URL pública do slide ${i + 1}`);
      }
      imageUrls.push(data.publicUrl);
      console.log(
        `✅ [render-carousel-slides] slide ${
          i + 1
        }/${list.length} (${png.length} bytes)`,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        image_urls: imageUrls,
        count: imageUrls.length,
        template: selectedTemplate,
      }),
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
