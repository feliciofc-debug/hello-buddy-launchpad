import {
  assert,
  assertEquals,
  assertGreaterOrEqual,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  buildDarkPremiumSlide,
  CARD_HEIGHT,
  CARD_WIDTH,
  type RenderContext,
  type RenderSlide,
} from "./carousel-templates/darkPremium.ts";
import { buildCleanBrightSlide } from "./carousel-templates/cleanBright.ts";
import { buildGradientVibrantSlide } from "./carousel-templates/gradientVibrant.ts";
import { buildElegantSerifSlide } from "./carousel-templates/elegantSerif.ts";
import { buildNeonTechSlide } from "./carousel-templates/neonTech.ts";
import {
  contrastRatio,
  contrastTextColor,
} from "./carousel-templates/shared.ts";
import type { CarouselTemplate } from "./carousel-styles.ts";

const builders: Record<
  CarouselTemplate,
  (slide: RenderSlide, context: RenderContext) => unknown
> = {
  "dark-premium": buildDarkPremiumSlide,
  "clean-bright": buildCleanBrightSlide,
  "gradient-vibrant": buildGradientVibrantSlide,
  "elegant-serif": buildElegantSerifSlide,
  "neon-tech": buildNeonTechSlide,
};

const slides: RenderSlide[] = [
  {
    type: "cover",
    title: "Marketing que transforma negócios",
    body: "Estratégia, conteúdo e resultado para sua empresa.",
  },
  {
    type: "content",
    number: 2,
    title: "Uma equipe completa",
    body:
      "• Estratégia com foco em vendas\n• Conteúdo profissional\n• Gestão de campanhas",
  },
  {
    type: "cta",
    number: 3,
    title: "Pronto para crescer?",
    body: "Fale com a nossa equipe e comece agora.",
  },
];

let setup:
  | Promise<{
    fonts: Array<{
      name: string;
      data: ArrayBuffer;
      weight: number;
      style: "normal";
    }>;
  }>
  | null = null;

function rendererSetup() {
  if (setup) return setup;
  setup = (async () => {
    const fontSpecs = [
      ["Inter", 400, "inter-latin-400-normal.woff"],
      ["Inter", 500, "inter-latin-500-normal.woff"],
      ["Inter", 700, "inter-latin-700-normal.woff"],
      ["Inter", 800, "inter-latin-800-normal.woff"],
      ["Inter", 900, "inter-latin-900-normal.woff"],
      [
        "Georgia",
        700,
        "playfair-display-latin-700-normal.woff",
      ],
    ] as const;
    const fonts = await Promise.all(
      fontSpecs.map(async ([name, weight, file]) => {
        const family = name === "Georgia" ? "playfair-display" : "inter";
        const version = name === "Georgia" ? "5.0.18" : "4.5.15";
        const response = await fetch(
          `https://cdn.jsdelivr.net/npm/@fontsource/${family}@${version}/files/${file}`,
        );
        assert(response.ok, `fonte ${name} ${weight} indisponível`);
        return {
          name,
          weight,
          style: "normal" as const,
          data: await response.arrayBuffer(),
        };
      }),
    );
    await initWasm(
      fetch(
        "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
      ),
    );
    return { fonts };
  })();
  return setup;
}

Deno.test("todos os templates renderizam capa, conteúdo e CTA em PNG 1080x1350", async (t) => {
  const { fonts } = await rendererSetup();
  const context: RenderContext = {
    primaryColor: "#F36812",
    secondaryColor: "#8B5CF6",
    totalSlides: slides.length,
    businessName: "AMZ Ofertas",
    profileHandle: "@amzofertas",
    ctaLabel: "Fale conosco",
  };

  for (const [template, builder] of Object.entries(builders)) {
    for (const slide of slides) {
      await t.step(`${template} / ${slide.type}`, async () => {
        const tree = builder(slide, context);
        const svg = await satori(tree as any, {
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          fonts: fonts as any,
        });
        const png = new Resvg(svg, {
          fitTo: { mode: "width", value: CARD_WIDTH },
        }).render().asPng();
        assertEquals(Array.from(png.slice(0, 8)), [
          137,
          80,
          78,
          71,
          13,
          10,
          26,
          10,
        ]);
        const image = await Image.decode(png);
        assertEquals(image.width, CARD_WIDTH);
        assertEquals(image.height, CARD_HEIGHT);
      });
    }
  }
});

Deno.test("texto automático mantém contraste WCAG em fundos personalizados", () => {
  assertEquals(contrastTextColor("#FFFFFF"), "#0F172A");
  assertEquals(contrastTextColor("#0F172A"), "#FFFFFF");
  for (const background of ["#FFFFFF", "#0F172A", "#F36812"]) {
    const text = contrastTextColor(background);
    assertGreaterOrEqual(
      contrastRatio(background, text),
      4.5,
      `${background} deveria ter contraste de corpo >= 4.5 com ${text}`,
    );
  }
});
