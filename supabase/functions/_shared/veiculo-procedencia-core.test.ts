import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizePlacaInput } from "./veiculo-procedencia-core.ts";
import { CONSULTAR_PLACA_TESTE } from "./consultar-placa-client.ts";

Deno.test("normalize placa", () => {
  assertEquals(normalizePlacaInput("abc-1d23"), "ABC1D23");
  assertEquals(normalizePlacaInput(CONSULTAR_PLACA_TESTE), CONSULTAR_PLACA_TESTE);
});
