import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  explicitVehiclePriceChoice,
  hasSpecificVehicleModel,
  isGenericVehicleTitle,
  isVehicleIdentificationAbandonRequest,
  isVehicleIdentificationConfirmation,
  looksLikeVehicleMakeModel,
  parseVehicleIdentification,
  resolveVehicleAdTitle,
  resolveVehiclePrice,
  validPendingVehicleIdentification,
  vehicleIdentificationButtons,
  vehicleIdentificationPrompt,
  vehicleIdentificationQuestion,
} from "./vehicle-identification.ts";

Deno.test("visão lateral sugere Fiat Grand Siena em vez de categoria genérica", () => {
  const result = parseVehicleIdentification(JSON.stringify({
    marca: "Fiat",
    modelo: "Grand Siena",
    geracao_ou_faixa_de_anos: "2012–2020",
    cor: "bege/champanhe",
    carroceria: "sedan",
    confianca: "media",
    pistas_visuais: ["linha lateral", "formato das lanternas"],
  }));
  assertEquals(result?.marca, "Fiat");
  assertEquals(result?.modelo, "Grand Siena");
  assert(hasSpecificVehicleModel(result));
  assert(
    vehicleIdentificationQuestion(result).startsWith(
      "Pela foto parece um Fiat Grand Siena (2012–2020), cor bege/champanhe. Confirma?",
    ),
  );
  assertEquals(
    vehicleIdentificationButtons().buttons.map((button) => button.title),
    ["Confirmar", "Corrigir modelo"],
  );
});

Deno.test("prompt exige modelo exato e resultado incerto pede dados", () => {
  assert(vehicleIdentificationPrompt().includes("marca e modelo exatos"));
  assert(vehicleIdentificationPrompt().includes("Não responda só a categoria"));
  const generic = parseVehicleIdentification(
    '{"marca":null,"modelo":null,"geracao_ou_faixa_de_anos":null,"cor":"prata","carroceria":"sedan","confianca":"baixa","pistas_visuais":[]}',
  );
  assertEquals(
    vehicleIdentificationQuestion(generic),
    "Não consegui identificar o modelo com segurança. Qual é a marca, o modelo e o ano?",
  );
});

Deno.test("títulos genéricos de veículo são proibidos", () => {
  for (
    const title of [
      "VEÍCULO SEDAN",
      "CARRO HATCH",
      "SUV",
      "Sedan",
    ]
  ) {
    assertEquals(isGenericVehicleTitle(title), true, title);
  }
  assertEquals(isGenericVehicleTitle("Fiat Grand Siena"), false);
});

Deno.test("sugestão visual não entra no anúncio antes da confirmação", () => {
  assertEquals(
    resolveVehicleAdTitle({
      requestedTitle: "Fiat Grand Siena",
      identification: { confirmed: false },
    }),
    { ok: false, reason: "unconfirmed_suggestion" },
  );
  assertEquals(
    resolveVehicleAdTitle({
      requestedTitle: "VEÍCULO SEDAN",
      identification: {
        confirmed: true,
        confirmed_title: "Fiat Grand Siena",
      },
    }),
    { ok: true, title: "Fiat Grand Siena" },
  );
});

Deno.test("confirmação textual, saída de fluxo e TTL são determinísticos", () => {
  const suggestion = parseVehicleIdentification(JSON.stringify({
    marca: "Fiat",
    modelo: "Grand Siena",
    geracao_ou_faixa_de_anos: "2012–2020",
    cor: "bege",
    carroceria: "sedan",
    confianca: "media",
    pistas_visuais: [],
  }));
  assert(isVehicleIdentificationConfirmation(
    "sim, 2014, 80 mil km, R$ 45.900",
    suggestion,
  ));
  assert(isVehicleIdentificationConfirmation(
    "é um Grand Siena",
    suggestion,
  ));
  assert(
    isVehicleIdentificationAbandonRequest(
      "edita essa foto e tira o fundo",
    ),
  );
  assert(!looksLikeVehicleMakeModel("faz um post"));
  assert(looksLikeVehicleMakeModel("Fiat Grand Siena"));
  assertEquals(explicitVehiclePriceChoice("deixa sem preço"), "Consulte");
  assertEquals(resolveVehiclePrice(undefined), { ok: false });
  assertEquals(resolveVehiclePrice("R$ 45.900"), {
    ok: true,
    value: "R$ 45.900",
  });
  assertEquals(resolveVehiclePrice("Consulte"), {
    ok: true,
    value: "Consulte",
  });
  const pending = { created_at: "2026-10-07T14:45:00.000Z" };
  assert(validPendingVehicleIdentification(
    pending,
    Date.parse("2026-10-07T15:00:00.000Z"),
  ));
  assertEquals(
    validPendingVehicleIdentification(
      pending,
      Date.parse("2026-10-07T15:15:00.001Z"),
    ),
    false,
  );
});
