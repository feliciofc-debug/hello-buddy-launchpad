import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoTrocaKbbUrl,
  labelGestaoTrocaKbbLink,
  lojaUfParaKbb,
  slugifyKbbModelo,
} from "./gestao-troca-kbb-url.ts";

Deno.test("URL completa com categoria", () => {
  const url = buildGestaoTrocaKbbUrl({
    uf: "sp",
    marca: "BMW",
    modelo: "X1 sDrive20i GP",
    ano_modelo: 2021,
    categoria: "suv-crossover",
  });
  assertEquals(url, "https://www.kbb.com.br/sp/marcas/bmw/suv-crossover/x1/2021");
});

Deno.test("sem categoria → só marca", () => {
  const url = buildGestaoTrocaKbbUrl({
    uf: "rj",
    marca: "BMW",
    modelo: "X1",
    ano_modelo: 2021,
    categoria: null,
  });
  assertEquals(url, "https://www.kbb.com.br/rj/marcas/bmw/");
});

Deno.test("marca com acento", () => {
  const url = buildGestaoTrocaKbbUrl({
    uf: "sp",
    marca: "Citroën",
    modelo: "C3",
    ano_modelo: 2020,
    categoria: "hatchback",
  });
  assertEquals(url, "https://www.kbb.com.br/sp/marcas/citroen/hatchback/c3/2020");
});

Deno.test("Land Rover — modelo slug completo", () => {
  assertEquals(
    slugifyKbbModelo("Range Rover Evoque", "Land Rover"),
    "range-rover-evoque",
  );
  const url = buildGestaoTrocaKbbUrl({
    uf: "sp",
    marca: "Land Rover",
    modelo: "Range Rover Evoque",
    ano_modelo: 2019,
    categoria: "suv-crossover",
  });
  assertEquals(
    url,
    "https://www.kbb.com.br/sp/marcas/land-rover/suv-crossover/range-rover-evoque/2019",
  );
});

Deno.test("UF da loja a partir de cidade/UF", () => {
  assertEquals(lojaUfParaKbb({ cidade_uf: "Rio de Janeiro / RJ" }), "rj");
  assertEquals(lojaUfParaKbb({ endereco: { uf: "SP" } }), "sp");
  assertEquals(lojaUfParaKbb({}), "sp");
});

Deno.test("rótulo do link", () => {
  assertEquals(
    labelGestaoTrocaKbbLink({
      marca: "BMW",
      modelo: "X1",
      ano_modelo: 2021,
      categoria: "suv-crossover",
    }),
    "Abrir BMW X1 2021 na KBB",
  );
  assertEquals(
    labelGestaoTrocaKbbLink({ marca: "BMW", modelo: "X1", categoria: null }),
    "Abrir BMW na KBB",
  );
});
