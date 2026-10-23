import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  webmotorsCodigoRetornoMessage,
  webmotorsCodigoRetornoMessageSingle,
} from "./webmotors-errors.ts";

Deno.test("WEBMOTORS-1.1 — traduz códigos conhecidos e compostos", () => {
  assertEquals(webmotorsCodigoRetornoMessageSingle("43|74"), "Placa obrigatória");
  assertEquals(
    webmotorsCodigoRetornoMessageSingle("22|78"),
    "Preço 'de' deve ser zero ou maior que o preço de venda",
  );
  assertEquals(webmotorsCodigoRetornoMessageSingle("43|55"), "Tipo de anúncio inválido");
  assertEquals(
    webmotorsCodigoRetornoMessageSingle("43|46"),
    "Informações Sim/Não obrigatórias do veículo",
  );
  assertEquals(
    webmotorsCodigoRetornoMessageSingle("43|54"),
    "Informações Sim/Não obrigatórias do veículo",
  );
  assertEquals(
    webmotorsCodigoRetornoMessageSingle("43|99"),
    "Campo obrigatório inválido (43|99)",
  );
  assertEquals(
    webmotorsCodigoRetornoMessage("43|74,22|78"),
    "Placa obrigatória Preço 'de' deve ser zero ou maior que o preço de venda",
  );
});
