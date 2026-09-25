import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
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
