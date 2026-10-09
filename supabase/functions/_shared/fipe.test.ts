import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createFipeClient,
  fipeListRows,
  fipeModelPageRows,
  fipePhotoSuggestionMessage,
  fipePriceRetryButtons,
} from "./fipe.ts";
import { decideFipeForAd, type LastFipeResult } from "./fipe-ad.ts";
import {
  filterFipeModelCandidates,
  filterFipeYearCandidates,
  normalizeFipeEngine,
  normalizeFipeYear,
  parseFipeRequestText,
} from "./fipe-input.ts";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("normalização encontra variantes de C3 PICASSO", async () => {
  const client = createFipeClient({
    token: "",
    fetcher: ((url: string | URL | Request) => {
      const path = String(url);
      if (path.endsWith("/cars/brands/13/models")) {
        return Promise.resolve(jsonResponse([
          { code: "5611", name: "C3 Picasso Excl. 1.6 Flex 16V 5p Aut." },
          { code: "5551", name: "C3 Picasso Exclusive 1.6 Flex 16V 5p Mec" },
          { code: "9999", name: "C4 Cactus" },
        ]));
      }
      throw new Error(`unexpected ${path}`);
    }) as typeof fetch,
  });
  const models = await client.listarModelos("13", "C3 PICASSO");
  assertEquals(models.map((item) => item.code), ["5611", "5551"]);
});

Deno.test("pedido falado do C3 Picasso normaliza ano e filtra versões automáticas", () => {
  const spoken = "me passa a fipe do c3 picasso dois mil e catorze automático";
  const input = parseFipeRequestText(spoken);
  assertEquals(
    parseFipeRequestText(`🎙️ Áudio transcrito: ${spoken}`),
    input,
  );
  assertEquals(input.marca, "Citroën");
  assertEquals(input.modelo, "C3 Picasso");
  assertEquals(input.ano_modelo, "2014");
  assertEquals(input.cambio, "automatico");
  const versions = filterFipeModelCandidates([
    { code: "5611", name: "C3 Picasso Excl. 1.6 Flex 16V 5p Aut." },
    { code: "5551", name: "C3 Picasso Exclusive 1.6 Flex 16V 5p Mec" },
    { code: "5552", name: "C3 Picasso GLX 1.6 Flex 16V 5p Aut." },
  ], input);
  assertEquals(versions.map((item) => item.code), ["5611", "5552"]);
});

Deno.test("pedido falado do Onix normaliza 2022 e motor 1.0", () => {
  const input = parseFipeRequestText(
    "fipe do onix vinte e dois um ponto zero",
  );
  assertEquals(input.marca, "Chevrolet");
  assertEquals(input.modelo, "Onix");
  assertEquals(input.ano_modelo, "2022");
  assertEquals(input.motor, "1.0");
  const versions = filterFipeModelCandidates([
    { code: "a", name: "ONIX HATCH 1.0 12V Flex 5p Mec." },
    { code: "b", name: "ONIX HATCH 1.4 8V FlexPower 5p Aut." },
  ], input);
  assertEquals(versions.map((item) => item.code), ["a"]);
});

Deno.test("ano curto e números de motor falados são normalizados", () => {
  assertEquals(normalizeFipeYear("C3 Picasso 14"), "2014");
  assertEquals(normalizeFipeYear("dois mil e quatorze"), "2014");
  assertEquals(normalizeFipeYear("vinte e quatro"), "2024");
  assertEquals(normalizeFipeEngine("um ponto seis"), "1.6");
  assertEquals(normalizeFipeEngine("um seis"), "1.6");
  assertEquals(normalizeFipeEngine("um ponto zero"), "1.0");
});

Deno.test("cache de listas evita a segunda chamada", async () => {
  let calls = 0;
  const client = createFipeClient({
    token: "",
    fetcher: (() => {
      calls++;
      return Promise.resolve(jsonResponse([{ code: "13", name: "Citroën" }]));
    }) as typeof fetch,
  });
  assertEquals((await client.buscarMarca("Citroen"))?.code, "13");
  assertEquals((await client.buscarMarca("Citroën"))?.code, "13");
  assertEquals(calls, 1);
});

Deno.test("erro de rede tenta uma vez de novo e não devolve preço", async () => {
  let calls = 0;
  const client = createFipeClient({
    token: "",
    fetcher: (() => {
      calls++;
      return Promise.reject(new TypeError("network down"));
    }) as typeof fetch,
  });
  await assertRejects(() => client.buscarMarca("Citroën"));
  assertEquals(calls, 2);
});

Deno.test("preço lento usa 25s em produção, tenta duas vezes e oferece retry", async () => {
  let calls = 0;
  const client = createFipeClient({
    token: "",
    timeoutMs: 1,
    fetcher: ((_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
        );
      });
    }) as typeof fetch,
  });
  await assertRejects(() =>
    client.consultarPreco({
      brandId: "7",
      modelId: "123",
      yearId: "2023-1",
    })
  );
  assertEquals(calls, 2);
  assertEquals(fipePriceRetryButtons().buttons, [{
    id: "fipe_price:retry",
    title: "🔄 Tentar de novo",
  }]);
});

Deno.test("lista interativa FIPE tem no máximo dez opções", () => {
  const rows = fipeListRows(
    Array.from({ length: 14 }, (_, index) => ({
      code: String(index),
      name: `Versão muito longa do veículo número ${index}`,
    })),
    "fipe_model",
  );
  assertEquals(rows.length, 10);
  assert(rows.every((row) => row.title.length <= 24));
});

Deno.test("modelos por ano usam o endpoint da marca e unem combustíveis", async () => {
  const calls: string[] = [];
  const client = createFipeClient({
    token: "",
    fetcher: ((url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      calls.push(path);
      if (path.endsWith("/cars/brands/56/years")) {
        return Promise.resolve(jsonResponse([
          { code: "2022-1", name: "2022 Gasolina" },
          { code: "2022-3", name: "2022 Diesel" },
          { code: "2021-3", name: "2021 Diesel" },
        ]));
      }
      if (path.endsWith("/years/2022-1/models")) {
        return Promise.resolve(jsonResponse([
          { code: "g1", name: "HILUX SW4 SRX 4.0 V6" },
        ]));
      }
      if (path.endsWith("/years/2022-3/models")) {
        return Promise.resolve(jsonResponse([
          { code: "d3", name: "Hilux GR-S 2.8 Diesel" },
          { code: "d1", name: "Hilux CD SRV 2.8 Diesel" },
          { code: "d2", name: "Hilux CD SRX 2.8 Diesel" },
          { code: "d4", name: "Hilux CD 2.8 Diesel" },
          { code: "d5", name: "Hilux CS 2.8 Diesel" },
        ]));
      }
      throw new Error(`unexpected ${path}`);
    }) as typeof fetch,
  });
  const models = await client.listarModelosPorAno("56", "2022", "hilux");
  assertEquals(models.length, 6);
  assertEquals(
    models.map((model) => model.name),
    [...models.map((model) => model.name)].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    ),
  );
  assertEquals(calls.some((path) => path.endsWith("/2021-3/models")), false);
});

Deno.test("menu de versões pagina sem cortar opções em silêncio", () => {
  const models = Array.from({ length: 23 }, (_, index) => ({
    code: String(index),
    name: `Versão ${index}`,
  }));
  const firstPage = fipeModelPageRows(models);
  assertEquals(firstPage.length, 10);
  assertEquals(firstPage.at(-1)?.id, "fipe_model:more:9");
  const secondPage = fipeModelPageRows(models, 9);
  assertEquals(secondPage.at(-1)?.id, "fipe_model:more:18");
  const thirdPage = fipeModelPageRows(models, 18);
  assertEquals(thirdPage.map((row) => row.id), [
    "fipe_model:18",
    "fipe_model:19",
    "fipe_model:20",
    "fipe_model:21",
    "fipe_model:22",
  ]);
});

Deno.test("ano informado com uma opção seleciona direto ano e combustível", () => {
  const years = filterFipeYearCandidates([
    { code: "2023-1", name: "2023 Gasolina" },
    { code: "2022-1", name: "2022 Gasolina" },
  ], "2023");
  assertEquals(years, [{ code: "2023-1", name: "2023 Gasolina" }]);
});

Deno.test("ano informado com combustíveis diferentes mantém só aquele ano", () => {
  const years = filterFipeYearCandidates([
    { code: "2023-1", name: "2023 Gasolina" },
    { code: "2023-3", name: "2023 Flex" },
    { code: "2022-1", name: "2022 Gasolina" },
  ], "2023");
  assertEquals(years.map((item) => item.code), ["2023-1", "2023-3"]);
});

function lastFipe(overrides: Partial<LastFipeResult> = {}): LastFipeResult {
  return {
    brand: "Citroën",
    model: "C3 Picasso Exclusive 1.6 Flex 16V 5p Aut.",
    modelYear: 2015,
    fuel: "Flex",
    price: "R$ 40.993,00",
    referenceMonth: "outubro de 2026",
    codeFipe: "011111-2",
    queryBrand: "Citroën",
    queryModel: "C3 Picasso",
    yearId: "2015-5",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

Deno.test("última FIPE entra no anúncio somente quando marca modelo e ano batem", () => {
  assertEquals(
    decideFipeForAd({
      last: lastFipe(),
      titulo: "Citroën C3 Picasso",
      ano: "2015",
    }),
    {
      action: "use_last",
      value: "R$ 40.993,00",
      referenceMonth: "outubro de 2026",
    },
  );
  assertEquals(
    decideFipeForAd({
      last: lastFipe(),
      titulo: "Citroën C4 Cactus",
      ano: "2015",
    }),
    { action: "none" },
  );
  assertEquals(
    decideFipeForAd({
      last: lastFipe(),
      titulo: "Citroën C3 Picasso",
      ano: "2014",
    }),
    { action: "none" },
  );
});

Deno.test("diferença FIPE acima de cinco por cento pede confirmação", () => {
  assertEquals(
    decideFipeForAd({
      last: lastFipe(),
      titulo: "Citroën C3 Picasso",
      ano: "2015",
      suppliedFipe: "R$ 50.000,00",
    }),
    {
      action: "confirm",
      queriedValue: "R$ 40.993,00",
      suppliedValue: "R$ 50.000,00",
      referenceMonth: "outubro de 2026",
    },
  );
});

Deno.test("identificação pela foto é sempre apresentada como sugestão", () => {
  const message = fipePhotoSuggestionMessage({
    brand: "Citroën",
    model: "C3 Picasso",
    earliestYear: 2011,
  });
  assert(message.startsWith("Parece um Citroën C3 Picasso"));
  assert(message.includes("a partir de 2011"));
  assert(message.endsWith("Confirma o ano/modelo e a versão?"));
});
