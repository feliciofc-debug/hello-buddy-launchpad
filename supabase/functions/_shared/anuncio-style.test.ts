import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anuncioStyleButtons,
  dominantProductAccentColor,
  recommendAnuncioStyle,
  renderAnuncioStyleOptions,
} from "./anuncio-style.ts";

Deno.test("recomendação de estilo combina com o produto visto", () => {
  assertEquals(
    recommendAnuncioStyle({
      title: "Fralda infantil",
      visualDescription: "Embalagem clara de produto para bebê",
    }),
    "catalogo",
  );
  assertEquals(
    recommendAnuncioStyle({
      title: "Interruptor",
      visualDescription: "Interruptor preto em embalagem escura",
    }),
    "impacto",
  );
  assertEquals(
    recommendAnuncioStyle({
      title: "Kit de sabonetes",
      badge: "Promoção com desconto",
    }),
    "destaque",
  );
});

Deno.test("preferência salva recomenda sem remover as três escolhas", () => {
  const recommended = recommendAnuncioStyle({
    title: "Fralda",
    preferred: "impacto",
  });
  const controls = anuncioStyleButtons(
    ["impacto", "catalogo", "destaque"],
    recommended,
  );
  assertEquals(controls.buttons.map((button) => button.title), [
    "Impacto",
    "Catálogo",
    "Destaque",
  ]);
  assertStringIncludes(controls.body, "⭐ Recomendo o Impacto");
});

Deno.test("pedido explícito pode renderizar somente um estilo", async () => {
  const calls: string[] = [];
  const result = await renderAnuncioStyleOptions(
    ["catalogo"],
    async (style) => {
      calls.push(style);
      return `${style}.jpg`;
    },
  );
  assertEquals(calls, ["catalogo"]);
  assertEquals(result.successes, [{
    style: "catalogo",
    render: "catalogo.jpg",
  }]);
  assertEquals(result.failedStyles, []);
});

Deno.test("falha em um render mantém as outras duas opções", async () => {
  const result = await renderAnuncioStyleOptions(
    ["impacto", "catalogo", "destaque"],
    async (style) => {
      if (style === "catalogo") throw new Error("render indisponível");
      return `${style}.jpg`;
    },
  );
  assertEquals(
    result.successes.map(({ style }) => style),
    ["impacto", "destaque"],
  );
  assertEquals(result.failedStyles, ["catalogo"]);
  assertEquals(
    anuncioStyleButtons(
      result.successes.map(({ style }) => style),
      "catalogo",
    ).buttons.length,
    2,
  );
});

Deno.test("accentColor segue a cor dominante com fallback legível", () => {
  assertEquals(
    dominantProductAccentColor("Embalagem predominantemente azul"),
    "#1D4ED8",
  );
  assertEquals(
    dominantProductAccentColor("Sem cor identificada", "#123456"),
    "#123456",
  );
});
