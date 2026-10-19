import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isProcedenciaWhatsAppRequest,
  parsePlacaFromProcedenciaText,
} from "./veiculo-procedencia-inbound.ts";
import { isValidBrazilPlaca, CONSULTAR_PLACA_TESTE } from "./consultar-placa-client.ts";

Deno.test("parse placa mercosul e antiga", () => {
  assertEquals(parsePlacaFromProcedenciaText("procedência ABC1D23"), "ABC1D23");
  assertEquals(parsePlacaFromProcedenciaText("consulta placa ABC1234"), "ABC1234");
  assert(isValidBrazilPlaca("ABC1D23"));
  assert(isValidBrazilPlaca(CONSULTAR_PLACA_TESTE));
  assertEquals(isValidBrazilPlaca("INVALID"), false);
});

Deno.test("gatilhos procedência", () => {
  assert(isProcedenciaWhatsAppRequest("puxa a placa ABC1D23"));
  assert(isProcedenciaWhatsAppRequest("consulta placa ABC1D23"));
  assert(!isProcedenciaWhatsAppRequest("qual a fipe"));
});

Deno.test("placa teste AAA0000", () => {
  assertEquals(parsePlacaFromProcedenciaText("procedencia AAA0000"), CONSULTAR_PLACA_TESTE);
});
