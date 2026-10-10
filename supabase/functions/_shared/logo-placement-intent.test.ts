import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  LOGO_PRODUCT_SIMULATION_NOTICE,
  logoImageEditPlan,
  logoPlacementMode,
  logoRequestHasScene,
  logoRequestIncludesPublication,
} from "./logo-placement-intent.ts";

Deno.test("pedido genérico de logo usa sempre o canto superior esquerdo", () => {
  for (
    const text of [
      "coloca a logo da AMZ Ofertas nessa imagem",
      "inclui a logo e publica no feed",
      "com a minha marca",
      "coloca a marca nessa foto",
    ]
  ) {
    assertEquals(logoPlacementMode(text), "top-left", text);
  }
  assertEquals(
    logoRequestIncludesPublication("inclui a logo e publica no feed"),
    true,
  );
});

Deno.test("objeto citado explicitamente mantém aplicação personalizada", () => {
  for (
    const text of [
      "estampa a logo na caneca",
      "coloca a logo na camiseta",
      "aplica a marca no boné",
      "coloca o logotipo na parede",
      "estampa a marca no carro",
    ]
  ) {
    assertEquals(logoPlacementMode(text), "object", text);
  }
  assertEquals(
    LOGO_PRODUCT_SIMULATION_NOTICE,
    "Isto é uma simulação de produto personalizado.",
  );
});

Deno.test("pedido composto de cenário e logo na caneca não vira carimbo", () => {
  const request =
    "ambiente bonito e elegante com cafeteira expresso em metal prata, estilo moedor de grãos, com a xícara com a logo da AMZ Ofertas, com café saindo da máquina e caindo na xícara da AMZ";
  assertEquals(logoRequestHasScene(request), true);
  assertEquals(logoPlacementMode(request), "object");
  assertEquals(logoImageEditPlan(request), {
    logoMode: "object",
    hasScene: true,
    strategy: "creative-edit",
    toolMode: "aplicar_logo_cenario",
  });
  assertEquals(logoPlacementMode("coloca minha logo"), "top-left");
  assertEquals(logoImageEditPlan("coloca minha logo").strategy, "overlay");
});
