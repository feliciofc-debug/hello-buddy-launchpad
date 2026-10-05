import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAnuncioBrandPlan,
} from "./anuncio-client-brand.ts";
import {
  type AnuncioData,
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
