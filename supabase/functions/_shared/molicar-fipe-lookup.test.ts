import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createFipeClient } from "./fipe.ts";
import { lookupFipeStrictByVehicleIdentity } from "./molicar-fipe-lookup.ts";
import {
  extractFipeCodigoFromPayload,
  molicarDecoderResponseKeyShape,
} from "./molicar-parser.ts";
import {
  lookupFipeForMolicarPlate,
  lookupFipeForMolicarResult,
} from "./veiculo-procedencia-inbound.ts";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hiluxClient(fetcher: typeof fetch) {
  return createFipeClient({ token: "", fetcher, timeoutMs: 5_000 });
}

Deno.test("FIPE.2 — decoder loga só nomes de chaves", () => {
  assertEquals(
    molicarDecoderResponseKeyShape({
      Decoder: { Plate: "PRW1F09", ModelYear: 2019 },
      VehicleData: { Brand: "Toyota", Model: "Hilux" },
      Pricing: { MolicarPrice: "100" },
    }),
    {
      nivel1: ["Decoder", "Pricing", "VehicleData"],
      nivel2: {
        Decoder: ["ModelYear", "Plate"],
        Pricing: ["MolicarPrice"],
        VehicleData: ["Brand", "Model"],
      },
    },
  );
});

Deno.test("FIPE.2 — extrai código FIPE de caminho alternativo", () => {
  assertEquals(
    extractFipeCodigoFromPayload({
      VehicleData: { Brand: "Toyota" },
      VehiclePricing: { FipeReference: { FipeCode: "004523-1" } },
    }),
    "004523-1",
  );
});

Deno.test("FIPE.2 — plano B com match único retorna preço", async () => {
  const client = hiluxClient(((url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith("/references")) {
      return Promise.resolve(jsonResponse([{ code: "320", month: "novembro/2026" }]));
    }
    if (path.endsWith("/cars/brands")) {
      return Promise.resolve(jsonResponse([{ code: "55", name: "Toyota" }]));
    }
    if (/\/cars\/brands\/55\/years\/[^/]+\/models$/.test(path)) {
      return Promise.resolve(jsonResponse([
        {
          code: "8421",
          name: "HILUX CD SRX 4X4 2.8 DIESEL AUT.",
        },
      ]));
    }
    if (path.endsWith("/cars/brands/55/years")) {
      return Promise.resolve(jsonResponse([{ code: "2019-3", name: "2019 Diesel" }]));
    }
    if (path.endsWith("/cars/brands/55/models/8421/years")) {
      return Promise.resolve(jsonResponse([{ code: "2019-3", name: "2019 Diesel" }]));
    }
    if (path.includes("/years/2019-3")) {
      return Promise.resolve(jsonResponse({
        brand: "Toyota",
        model: "HILUX CD SRX 4X4 2.8 DIESEL AUT.",
        modelYear: 2019,
        fuel: "Diesel",
        price: "R$ 212.345,00",
        referenceMonth: "novembro de 2026",
        codeFipe: "004523-1",
      }));
    }
    throw new Error(`unexpected ${path}`);
  }) as typeof fetch);

  const result = await lookupFipeStrictByVehicleIdentity({
    marca: "Toyota",
    modelo: "Hilux",
    versao: "CD SRX 4x4 2.8 TB AT",
    ano_modelo: 2019,
    combustivel: "Diesel",
  }, client);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.quote.price, "R$ 212.345,00");
    assertStringIncludes(result.quote.referenceMonth, "novembro");
  }
});

Deno.test("FIPE.2 — plano B ambíguo omite", async () => {
  const client = hiluxClient(((url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith("/references")) {
      return Promise.resolve(jsonResponse([{ code: "320", month: "novembro/2026" }]));
    }
    if (path.endsWith("/cars/brands")) {
      return Promise.resolve(jsonResponse([{ code: "55", name: "Toyota" }]));
    }
    if (/\/cars\/brands\/55\/years\/[^/]+\/models$/.test(path)) {
      return Promise.resolve(jsonResponse([
        {
          code: "8421",
          name: "HILUX CD SRX 4X4 2.8 DIESEL AUT.",
        },
        {
          code: "8422",
          name: "HILUX CD SRX 4X4 2.8 DIESEL AUT. (OUTRA)",
        },
      ]));
    }
    if (path.endsWith("/cars/brands/55/years")) {
      return Promise.resolve(jsonResponse([{ code: "2019-3", name: "2019 Diesel" }]));
    }
    if (path.endsWith("/cars/brands/55/models/8421/years")) {
      return Promise.resolve(jsonResponse([{ code: "2019-3", name: "2019 Diesel" }]));
    }
    if (path.endsWith("/cars/brands/55/models/8422/years")) {
      return Promise.resolve(jsonResponse([{ code: "2019-3", name: "2019 Diesel" }]));
    }
    throw new Error(`unexpected ${path}`);
  }) as typeof fetch);

  const result = await lookupFipeStrictByVehicleIdentity({
    marca: "Toyota",
    modelo: "Hilux",
    versao: "CD SRX 4x4 2.8 TB AT",
    ano_modelo: 2019,
    combustivel: "Diesel",
  }, client);
  assertEquals(result, { ok: false, omit: "ambiguo" });
});

Deno.test("FIPE.2 — timeout de FIPE não segura resposta da placa", async () => {
  const started = Date.now();
  const quote = await lookupFipeForMolicarPlate({
    dados: {
      marca: "Toyota",
      modelo: "Hilux",
      versao: "CD SRX",
      ano_modelo: 2019,
      combustivel: "Diesel",
    },
    precos: { referencia: 100_000 },
  }, {
    strictByVehicle: () =>
      new Promise(() => {
        /* pendurado de propósito */
      }),
  }, 80);
  assertEquals(quote, null);
  assert(Date.now() - started < 500);
});

Deno.test("FIPE.2 — sem código usa plano B no lookup da placa", async () => {
  const quote = await lookupFipeForMolicarResult({
    fipe_codigo: null,
    dados: {
      marca: "Toyota",
      modelo: "Hilux",
      versao: "CD SRX 4X4 2.8 TB AT",
      ano_modelo: 2019,
      combustivel: "Diesel",
    },
    precos: {},
  }, {
    strictByVehicle: async () => ({
      ok: true,
      quote: {
        price: "R$ 212.345,00",
        referenceMonth: "novembro de 2026",
        source: "fipe_publica",
      },
    }),
  });
  assertEquals(quote?.price, "R$ 212.345,00");
});

function assertStringIncludes(haystack: string, needle: string) {
  assert(haystack.includes(needle), `expected ${needle} in ${haystack}`);
}
