import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  logoDe,
  mesclarCamadaB,
  type IdentidadeSite,
} from "./site-identidade.ts";
import { paletaAPartirDe } from "./video-cores.ts";

function identidadeBase(): IdentidadeSite {
  return {
    url: "https://cliente.example/",
    dominio: "cliente.example",
    parcial: true,
    avisos: [],
    nome_empresa: "",
    tagline: "",
    descricao: "",
    segmento_sugerido: "outros",
    tom_de_voz: "",
    publico_alvo: "",
    diferenciais: "",
    logo_url: null,
    logo_origem: null,
    logo_data_url: null,
    fontes: [],
    cores_detectadas: [],
    paleta: paletaAPartirDe({}),
    texto_base: "",
  };
}

Deno.test("SPA sem evidência não transforma fallback em cor detectada", () => {
  const identidade = mesclarCamadaB(identidadeBase(), {});
  assertEquals(identidade.cores_detectadas, []);
  assertEquals(
    identidade.avisos.some((aviso) => aviso.includes("cores confiáveis")),
    true,
  );
});

Deno.test("cores da página renderizada registram proveniência", () => {
  const identidade = mesclarCamadaB(identidadeBase(), {
    cores: [{ hex: "#123456", peso: 20 }],
  });
  assertEquals(identidade.cores_detectadas[0]?.origem, "pagina_renderizada");
});

Deno.test("cores amostradas da logo prevalecem e registram proveniência", () => {
  const identidade = mesclarCamadaB(identidadeBase(), {
    cores: [{ hex: "#abcdef", peso: 100 }],
    logo_cores: [{ hex: "#c02030", peso: 10 }],
  });
  assertEquals(identidade.cores_detectadas.map((cor) => cor.hex), ["#c02030"]);
  assertEquals(identidade.cores_detectadas[0]?.origem, "logo_renderizada");
});

Deno.test("og:image não é tratado como logo em SPA", () => {
  const candidatos = logoDe(
    '<meta property="og:image" content="/banner-landing-page.jpg">',
    new URL("https://cliente.example/"),
  );
  assertEquals(candidatos.some((item) => item.origem === "og:image"), false);
});

Deno.test("Camada B sem bytes não mistura sua URL com imagem da Camada A", () => {
  const base = {
    ...identidadeBase(),
    logo_url: "https://cliente.example/logo-a.png",
    logo_data_url: "data:image/png;base64,YQ==",
    logo_origem: "img_logo_html",
  };
  const identidade = mesclarCamadaB(base, {
    logo_url: "https://cliente.example/logo-b.png",
    logo_data_url: null,
  });
  assertEquals(identidade.logo_url, base.logo_url);
  assertEquals(identidade.logo_data_url, base.logo_data_url);
});
