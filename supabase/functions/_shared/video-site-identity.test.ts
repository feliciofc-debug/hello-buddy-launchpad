import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { BrandSiteIdentity } from "./brand-site-identity.ts";
import type { IdentidadeSite } from "./site-identidade.ts";
import { completeSiteIdentityWithRenderedPage } from "./video-site-identity.ts";

const emptyFastIdentity: BrandSiteIdentity = {
  url: "https://cliente.example/",
  colors: [],
  brand_name: null,
  logo_url: null,
  logo_data_url: null,
  logo_confidence: "none",
};

function detailedIdentity(
  overrides: Partial<IdentidadeSite> = {},
): IdentidadeSite {
  return {
    url: emptyFastIdentity.url,
    dominio: "cliente.example",
    parcial: true,
    avisos: ["sem conteúdo suficiente"],
    nome_empresa: "",
    tagline: "",
    descricao: "",
    segmento_sugerido: "",
    tom_de_voz: "",
    publico_alvo: "",
    diferenciais: "",
    logo_url: null,
    logo_origem: null,
    logo_data_url: null,
    fontes: [],
    cores_detectadas: [],
    paleta: {
      bg: "#0b0f14",
      bg2: "#101826",
      panel: "#111b29",
      line: "#203047",
      destaque: "#ff7a1a",
      destaqueSoft: "#ff9e56",
      texto: "#f4f7fb",
      suave: "#93a4b8",
    },
    texto_base: "",
    ...overrides,
  };
}

Deno.test("camada B completa automaticamente logo e cores ausentes na leitura rápida", async () => {
  let inserted = false;
  const rendered = detailedIdentity({
    parcial: false,
    nome_empresa: "Cliente Renderizado",
    logo_url: "https://cliente.example/logo.png",
    logo_data_url: "data:image/png;base64,bG9nbw==",
    cores_detectadas: [
      { hex: "#123456", peso: 20, origem: "pagina_renderizada" },
    ],
  });
  const sb = {
    from: () => ({
      insert: () => {
        inserted = true;
        return {
          select: () => ({
            single: async () => ({ data: { id: "job-1" }, error: null }),
          }),
        };
      },
      select: () => {
        const query = {
          eq: () => query,
          maybeSingle: async () => ({
            data: { status: "concluido", identidade: rendered },
            error: null,
          }),
        };
        return query;
      },
    }),
  };

  const result = await completeSiteIdentityWithRenderedPage(
    sb,
    "tenant-1",
    emptyFastIdentity,
    { readLayerA: async () => detailedIdentity() },
  );

  assertEquals(inserted, true);
  assertEquals(result.brand_name, "Cliente Renderizado");
  assertEquals(result.logo_confidence, "high");
  assertEquals(result.colors, ["#123456"]);
});

Deno.test("identidade rápida confiável não abre job de render", async () => {
  let queried = false;
  const sb = {
    from: () => {
      queried = true;
      return {};
    },
  };
  const fast: BrandSiteIdentity = {
    ...emptyFastIdentity,
    colors: ["#abcdef"],
  };
  assertEquals(
    await completeSiteIdentityWithRenderedPage(sb, "tenant-1", fast),
    fast,
  );
  assertEquals(queried, false);
});
