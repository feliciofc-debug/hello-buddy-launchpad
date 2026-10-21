import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateVehicleAdCaptions } from "./anuncio-veiculo-captions.ts";
import { generateProductAdCaptions } from "./anuncio-produto-captions.ts";
import {
  generateVehicleAdCaptions as routeVehicleCaptions,
} from "./anuncio-social-flow.ts";
import {
  vehicleCaptionDataFromSources,
  vehicleCaptionMissingKmOrPreco,
} from "./vehicle-social-caption.ts";

const fullVehicle = {
  titulo: "JEEP RENEGADE Longitude T270 1.3 Flex",
  versao: "Longitude T270",
  ano: "2022",
  quilometragem: "45.000 km",
  cambio: "Automático",
  combustivel: "Flex",
  cor: "Prata",
  preco: "R$ 118.900",
  fipe: "R$ 122.000",
  opcionais: ["Ar-condicionado", "Multimídia", "Rodas de liga"],
  condicoes: ["Aceita troca", "Financia"],
  telefone: "5521999998888",
  cidade_loja: "Niterói",
};

Deno.test("COPY-VEICULO — opções A/B/C trazem km, preço e itens informados", () => {
  const captions = generateVehicleAdCaptions(fullVehicle, 0);
  for (const text of Object.values(captions)) {
    assertStringIncludes(text, "45.000 km");
    assertStringIncludes(text, "R$ 118.900");
    assertStringIncludes(text, "Automático");
    assertStringIncludes(text, "Ar-condicionado");
    assertStringIncludes(text, "📲 Chame no WhatsApp: https://wa.me/5521999998888");
    assert(text.length <= 900);
    assert(!/\bgarantia\b/i.test(text));
    assert(!/\búnico dono\b/i.test(text));
  }
  assertStringIncludes(captions.A, "🚗 JEEP RENEGADE");
});

Deno.test("COPY-VEICULO — sem preço não cita valor de venda (FIPE pode aparecer)", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Fiat Argo",
    quilometragem: "30.000 km",
  }, 0);
  const joined = Object.values(captions).join("\n");
  assert(!joined.includes("💰"));
  const withFipe = generateVehicleAdCaptions({
    titulo: "Fiat Argo",
    quilometragem: "30.000 km",
    fipe: "R$ 55.000",
  }, 0);
  assertStringIncludes(Object.values(withFipe).join("\n"), "R$ 55.000");
});

Deno.test("COPY-VEICULO — sem itens não inventa revisão/garantia/laudo", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Honda Civic",
    ano: "2020",
    cambio: "Manual",
  }, 0);
  const text = Object.values(captions).join(" ").toLowerCase();
  for (const term of ["garantia", "laudo", "único dono", "revisado", "baixa km"]) {
    assert(!text.includes(term));
  }
});

Deno.test("COPY-VEICULO — produto AMZ permanece idêntico ao gerador de produto", () => {
  const data = {
    titulo: "Interruptor Tramontina",
    itens: ["Bivolt automático", "Cor branca"],
    preco: "R$ 49,90",
    telefone: "5592999999999",
  };
  assertEquals(routeVehicleCaptions(data, 0, "produto"), generateProductAdCaptions(data));
});

Deno.test("COPY-VEICULO — gate km/preço", () => {
  const missing = vehicleCaptionMissingKmOrPreco(
    vehicleCaptionDataFromSources({
      nome: "Jeep Compass",
      descricao: "ano 2021 automático",
    }),
  );
  assertEquals(missing.includes("km"), true);
  assertEquals(missing.includes("preco"), true);
});
