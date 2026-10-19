import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizePlacaInput,
  procedenciaCompetenciaAtual,
  procedenciaCompetenciaUtcBounds,
} from "./veiculo-procedencia-core.ts";
import { CONSULTAR_PLACA_TESTE } from "./consultar-placa-client.ts";

Deno.test("normalize placa", () => {
  assertEquals(normalizePlacaInput("abc-1d23"), "ABC1D23");
  assertEquals(normalizePlacaInput(CONSULTAR_PLACA_TESTE), CONSULTAR_PLACA_TESTE);
});

Deno.test("competência procedência usa fuso São Paulo", () => {
  const ym = procedenciaCompetenciaAtual(new Date("2026-10-01T02:00:00.000Z"));
  assertEquals(ym, "2026-09");
  const bounds = procedenciaCompetenciaUtcBounds("2026-10");
  assertEquals(bounds.startIso, "2026-10-01T03:00:00.000Z");
});
