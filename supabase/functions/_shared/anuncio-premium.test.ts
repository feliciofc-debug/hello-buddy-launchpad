import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  buildAnuncioBrandPlan,
} from "./anuncio-client-brand.ts";
import { selectAnuncioPhoto } from "./anuncio-photo.ts";
import {
  amzAnuncioClientButtons,
  shouldAskAmzAnuncioClient,
} from "./anuncio-tenant-brand.ts";
import {
  ANUNCIO_FOOTER_BOXES,
  type AnuncioData,
  anuncioSize,
  buildAnuncio,
  contrastRatio,
  readableAccent,
} from "./anuncio-templates/darkGold.ts";

const savedBase = {
  user_id: "tenant-1",
  client_name: "Loja Premium",
  normalized_name: "lojapremium",
};

Deno.test("identidade do anúncio usa logo cadastrada do cliente", () => {
  assertEquals(
    buildAnuncioBrandPlan({
      clientName: "Loja Premium",
      saved: {
        ...savedBase,
        logo_path: "tenant-1/client-brands/logo.png",
        identity: { colors: ["#E30613"] },
      },
    }),
    {
      mode: "client",
      businessName: "Loja Premium",
      logoPath: "tenant-1/client-brands/logo.png",
      colors: ["#E30613"],
    },
  );
});

Deno.test("cliente sem logo usa site informado ou salvo para extração", () => {
  assertEquals(
    buildAnuncioBrandPlan({
      clientName: "Loja Premium",
      saved: { ...savedBase, site_url: "https://loja.example" },
    }),
    {
      mode: "extract_site",
      businessName: "Loja Premium",
      site: "https://loja.example",
    },
  );
});

Deno.test("cliente sem logo e sem site bloqueia fallback do tenant", () => {
  assertEquals(
    buildAnuncioBrandPlan({ clientName: "Loja Premium" }),
    { mode: "missing", businessName: "Loja Premium" },
  );
});

Deno.test("anúncio sem cliente mantém identidade do tenant", () => {
  assertEquals(buildAnuncioBrandPlan({}), { mode: "tenant" });
});

function baseData(overrides: Partial<AnuncioData> = {}): AnuncioData {
  return {
    titulo: "SUV PREMIUM",
    itens: [],
    primaryColor: "#8A6A12",
    accentColor: "#E8B93B",
    formato: "feed",
    ...overrides,
  };
}

function flatten(node: unknown): any[] {
  if (!node || typeof node !== "object") return [];
  const current = node as any;
  const children = current.props?.children;
  return [
    current,
    ...(Array.isArray(children)
      ? children.flatMap(flatten)
      : flatten(children)),
  ];
}

Deno.test("campos opcionais ausentes não aparecem no template", () => {
  const nodes = flatten(buildAnuncio(baseData()));
  const text = nodes.map((node) =>
    typeof node.props?.children === "string" ? node.props.children : ""
  ).join(" ");
  assert(!text.includes("FIPE"));
  assert(!text.includes("VALOR"));
  assert(!text.includes("HOJE"));
  assert(!text.includes("2023"));
  assertEquals(nodes.some((node) => node.props?.style?.textDecoration === "line-through"), false);
});

Deno.test("preço de referência só aparece riscado quando informado", () => {
  const withoutReference = flatten(buildAnuncio(baseData({ preco: "R$ 99.900" })));
  assertEquals(
    withoutReference.some((node) => node.props?.style?.textDecoration === "line-through"),
    false,
  );

  const withReference = flatten(buildAnuncio(baseData({
    preco: "R$ 99.900",
    precoLabel: "HOJE",
    precoReferencia: "R$ 110.000",
    precoReferenciaLabel: "FIPE",
    precoReferenciaObs: "sem blindagem",
  })));
  assert(
    withReference.some((node) => node.props?.style?.textDecoration === "line-through"),
  );
});

Deno.test("quatro a oito itens são distribuídos em duas colunas", () => {
  for (const count of [4, 8]) {
    const nodes = flatten(buildAnuncio(baseData({
      itens: Array.from({ length: count }, (_, index) => ({
        texto: `ITEM ${index + 1}`,
      })),
    })));
    assertEquals(
      nodes.filter((node) => node.props?.style?.width === "48%").length,
      count,
    );
  }
});

Deno.test("cor clara do cliente mantém textos legíveis", () => {
  const palette = readableAccent("#FFF59D");
  assert(contrastRatio(palette.textColor, "#08090B") >= 4.5);
  assert(contrastRatio(palette.onAccentColor, palette.detailColor) >= 4.5);
});

Deno.test("cor escura é clareada para contraste mínimo no título", () => {
  const palette = readableAccent("#102030");
  assert(palette.adjusted);
  assert(contrastRatio(palette.textColor, "#08090B") >= 4.5);
});

Deno.test("falha da foto melhorada usa a original", async () => {
  const attempts: string[] = [];
  const selected = await selectAnuncioPhoto({
    preferred: "https://cdn.example/melhorada.jpg",
    original: "https://cdn.example/original.jpg",
    load: async (url) => {
      attempts.push(url);
      return url.includes("original") ? "original-data" : null;
    },
  });
  assertEquals(attempts, [
    "https://cdn.example/melhorada.jpg",
    "https://cdn.example/original.jpg",
  ]);
  assertEquals(selected, { value: "original-data", source: "original" });
});

function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}

Deno.test("rodapé reserva faixas sem sobrepor logo e contatos", () => {
  assertEquals(
    overlaps(ANUNCIO_FOOTER_BOXES.feed.logo, ANUNCIO_FOOTER_BOXES.feed.contacts),
    false,
  );
  assertEquals(
    overlaps(ANUNCIO_FOOTER_BOXES.story.logo, ANUNCIO_FOOTER_BOXES.story.contacts),
    false,
  );
});

Deno.test("logo horizontal usa contain e preserva proporção", () => {
  const tree = buildAnuncio(baseData({
    logoDataUrl: "data:image/png;base64,LOGO_HORIZONTAL",
  }));
  const logo = flatten(tree).find((node) =>
    node.type === "img" &&
    node.props?.src === "data:image/png;base64,LOGO_HORIZONTAL"
  );
  assertEquals(logo?.props?.style?.objectFit, "contain");
  assertEquals(logo?.props?.style?.width, "100%");
  assertEquals(logo?.props?.style?.height, "100%");
});

Deno.test("tenant AMZ sem cliente pergunta a loja e botão libera marca AMZ", () => {
  assertEquals(shouldAskAmzAnuncioClient({
    tenantId: "amz",
    amzTenantId: "amz",
  }), true);
  assertEquals(amzAnuncioClientButtons().buttons, [
    { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
  ]);
  assertEquals(shouldAskAmzAnuncioClient({
    tenantId: "amz",
    amzTenantId: "amz",
    useTenantBrand: true,
  }), false);
  assertEquals(shouldAskAmzAnuncioClient({
    tenantId: "outro",
    amzTenantId: "amz",
  }), false);
});

let renderWasmReady: Promise<void> | null = null;

async function renderTemplateWithRealPhoto(
  formato: "feed" | "story",
): Promise<Image> {
  const photoResponse = await fetch(
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&auto=format&fit=crop",
  );
  assert(photoResponse.ok);
  const photoBytes = new Uint8Array(await photoResponse.arrayBuffer());
  const photoMime = photoResponse.headers.get("content-type") || "image/jpeg";
  let binary = "";
  for (let offset = 0; offset < photoBytes.length; offset += 8192) {
    binary += String.fromCharCode(...photoBytes.subarray(offset, offset + 8192));
  }
  const font = await (await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff",
  )).arrayBuffer();
  const { width, height } = anuncioSize(formato);
  const tree = buildAnuncio(baseData({
    formato,
    fotoDataUrl: `data:${photoMime};base64,${btoa(binary)}`,
    subtitulo: "AUTOMÁTICO • BLINDADO",
    ano: "2023/2023",
    itens: ["38 MIL KM", "ÚNICO DONO", "REVISADO", "PNEUS NOVOS"].map(
      (texto) => ({ texto }),
    ),
  }));
  const svg = await satori(tree as any, {
    width,
    height,
    fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
  });
  renderWasmReady ??= initWasm(fetch(
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
  ));
  await renderWasmReady;
  return await Image.decode(
    new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng(),
  );
}

function regionDeviation(
  image: Image,
  box: { x: number; y: number; width: number; height: number },
): number {
  const values: number[] = [];
  const step = 12;
  for (let y = box.y; y < box.y + box.height; y += step) {
    for (let x = box.x; x < box.x + box.width; x += step) {
      const offset = (y * image.width + x) * 4;
      values.push(
        image.bitmap[offset] * 0.2126 +
          image.bitmap[offset + 1] * 0.7152 +
          image.bitmap[offset + 2] * 0.0722,
      );
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length,
  );
}

Deno.test("foto real permanece visível e não uniforme em feed e story", async () => {
  const feed = await renderTemplateWithRealPhoto("feed");
  const story = await renderTemplateWithRealPhoto("story");
  assert(regionDeviation(feed, { x: 140, y: 270, width: 800, height: 340 }) > 12);
  assert(regionDeviation(story, { x: 140, y: 380, width: 800, height: 620 }) > 12);
});
