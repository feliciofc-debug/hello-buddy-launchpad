import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  companyServiceProfilePrompt,
  PREMIUM_VEHICLE_RETAIL_SEGMENT,
  suggestCompanyServiceProfile,
} from "./company-service-profile.ts";

Deno.test("loja de peças mantém o perfil automotivo existente", () => {
  assertEquals(
    suggestCompanyServiceProfile(
      "automotivo",
      "Venda de peças e acessórios compatíveis para carros, com instalação.",
    ),
    "automotivo",
  );
});

Deno.test("compra e venda de veículos sugere revenda premium", () => {
  assertEquals(
    suggestCompanyServiceProfile(
      "automotivo",
      "Compra e venda de veículos premium, seminovos e avaliação na troca.",
    ),
    PREMIUM_VEHICLE_RETAIL_SEGMENT,
  );
});

Deno.test("texto automotivo não troca outro segmento selecionado", () => {
  assertEquals(
    suggestCompanyServiceProfile(
      "servicos-profissionais",
      "Consultoria para compra e venda de veículos.",
    ),
    "servicos-profissionais",
  );
});

Deno.test("prompt premium impõe estoque real, handoff e proíbe pressão", () => {
  const prompt = companyServiceProfilePrompt(
    PREMIUM_VEHICLE_RETAIL_SEGMENT,
  )!;
  assertStringIncludes(prompt, "NUNCA invente preço, quilometragem, blindagem, disponibilidade");
  assertStringIncludes(prompt, "estoque cadastrado");
  assertStringIncludes(prompt, "confirmar com o consultor");
  assertStringIncludes(prompt, "Nunca pressione");
  assertStringIncludes(prompt, "últimas unidades");
  assertStringIncludes(prompt, "Bom dia, a Defender ainda está disponível?");
});
