import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createFipePriceRetryState,
  filterFipeModelsByYear,
  fipeInputFromConfirmedVehicle,
  fipeInputFromTextAndBrands,
  fipeModelDecision,
  fipeYearAvailabilityDecision,
  fipeYearDecision,
  isExplicitFipeRequest,
  isFipePhotoReference,
  resolveFipePhotoSource,
  vehicleFipeTurn,
} from "./fipe-routing.ts";

const brands = [
  { code: "7", name: "BMW" },
  { code: "59", name: "VW - VolksWagen" },
  { code: "23", name: "Chevrolet" },
  { code: "39", name: "Mercedes-Benz" },
];

const confirmedTank = {
  confirmed: true,
  confirmed_title: "GWM Tank 300",
  identification: { marca: "GWM", modelo: "Tank 300" },
  data: { titulo: "GWM Tank 300" },
};

Deno.test("FIPE explícita tem precedência sobre identificação de anúncio", () => {
  const request = "qual a fipe desse carro?";
  const input = fipeInputFromConfirmedVehicle(request, confirmedTank);
  assertEquals(input.marca, "GWM");
  assertEquals(input.modelo, "Tank 300");
  assertEquals(vehicleFipeTurn(request, input), "fipe_lookup");
  assertEquals(vehicleFipeTurn("2025", input, true), "fipe_pending");
});

Deno.test("FIPE completa do GWM Tank 300 segue direto para consulta", () => {
  const request = "qual a FIPE do GWM Tank 300 2025?";
  const input = fipeInputFromConfirmedVehicle(request, null);
  assertEquals(input, {
    marca: "GWM",
    modelo: "Tank 300",
    ano_modelo: "2025",
    versao: undefined,
    combustivel: undefined,
    cambio: undefined,
    motor: undefined,
  });
  assertEquals(vehicleFipeTurn(request, input), "fipe_lookup");
});

Deno.test("variações explícitas de consulta FIPE não caem no anúncio", () => {
  for (
    const text of [
      "tabela fipe desse carro",
      "consulta a fipe",
      "cota a fipe",
      "quanto vale na fipe",
      "qual a fipi do corolla 2019",
      "qual a fip desse carro",
    ]
  ) {
    assertEquals(isExplicitFipeRequest(text), true, text);
  }
});

Deno.test("BMW 320i com ano é extraída pela lista oficial de marcas", () => {
  const request = "Fipe da Bmw 320i ano 2023";
  const input = fipeInputFromTextAndBrands(request, null, brands);
  assertEquals(input.marca, "BMW");
  assertEquals(input.modelo, "320i");
  assertEquals(input.ano_modelo, "2023");
  assertEquals(vehicleFipeTurn(request, input), "fipe_lookup");
  assertEquals(
    fipeModelDecision([
      { code: "a", name: "320i 2.0 Turbo ActiveFlex" },
      { code: "b", name: "320i 2.0 Turbo Gasolina" },
    ]).action,
    "choose",
  );
});

Deno.test("aliases de modelo continuam funcionando sem marca", () => {
  const input = fipeInputFromTextAndBrands("fipe onix 2020", null, brands);
  assertEquals(input.marca, "Chevrolet");
  assertEquals(input.modelo, "Onix");
  assertEquals(input.ano_modelo, "2020");
});

Deno.test("texto sem marca reconhecível segue para a IA", () => {
  const request = "me passa a fipe do meu carro 2023";
  const input = fipeInputFromTextAndBrands(request, null, brands);
  assertEquals(input.marca, undefined);
  assertEquals(vehicleFipeTurn(request, input), "fipe_ai");
});

Deno.test("referência à foto anterior é reconhecida", () => {
  assertEquals(
    isFipePhotoReference("me passa a fipe do veículo da imagem"),
    true,
  );
  assertEquals(
    resolveFipePhotoSource({
      text: "me passa a fipe do veículo da imagem",
      hasCurrentPhoto: false,
      hasRecentPhoto: true,
    }),
    "recent",
  );
});

Deno.test("falha de preço preserva escolhas para tentar novamente", () => {
  const state = createFipePriceRetryState({
    brand: { code: "7", name: "BMW" },
    model: { code: "123", name: "320i 2.0 Turbo" },
    year: { code: "2023-1", name: "2023 Gasolina" },
    queryModel: "320i",
    createdAt: "2026-10-09T19:00:00.000Z",
  });
  assertEquals(state, {
    stage: "price_retry",
    brand: { code: "7", name: "BMW" },
    model: { code: "123", name: "320i 2.0 Turbo" },
    year: { code: "2023-1", name: "2023 Gasolina" },
    queryModel: "320i",
    created_at: "2026-10-09T19:00:00.000Z",
  });
});

Deno.test("versão escolhida e ano com uma opção consulta preço direto", () => {
  assertEquals(
    fipeYearDecision([{ code: "2023-1", name: "2023 Gasolina" }]),
    {
      action: "price",
      year: { code: "2023-1", name: "2023 Gasolina" },
    },
  );
  assertEquals(
    fipeYearDecision([
      { code: "2023-1", name: "2023 Gasolina" },
      { code: "2023-3", name: "2023 Flex" },
    ]).action,
    "choose",
  );
});

Deno.test("ano pedido mantém somente versões disponíveis naquele ano", async () => {
  const models = [
    { code: "sport", name: "320i Sport" },
    { code: "gt", name: "320iA GT Sport" },
    { code: "m", name: "320i M Sport" },
  ];
  const yearsByModel: Record<string, Array<{ code: string; name: string }>> = {
    sport: [{ code: "2023-1", name: "2023 Gasolina" }],
    gt: [{ code: "2018-1", name: "2018 Gasolina" }],
    m: [
      { code: "2023-1", name: "2023 Gasolina" },
      { code: "2022-1", name: "2022 Gasolina" },
    ],
  };
  const result = await filterFipeModelsByYear(
    models,
    "2023",
    async (modelId) => yearsByModel[modelId],
  );
  assertEquals(result.status, "filtered");
  assertEquals(result.models, [models[0], models[2]]);
});

Deno.test("versão sem o ano conserva seus anos como saída", () => {
  const availableYears = [
    { code: "2018-1", name: "2018 Gasolina" },
    { code: "2017-1", name: "2017 Gasolina" },
  ];
  assertEquals(
    fipeYearAvailabilityDecision(availableYears, "2023"),
    { action: "requested_unavailable", years: availableYears },
  );
});

Deno.test("falha ao consultar anos mantém a lista sem filtro", async () => {
  const models = [
    { code: "sport", name: "320i Sport" },
    { code: "gt", name: "320iA GT Sport" },
  ];
  const result = await filterFipeModelsByYear(
    models,
    "2023",
    () => Promise.reject(new Error("api indisponível")),
  );
  assertEquals(result, { status: "fallback", models });
});
