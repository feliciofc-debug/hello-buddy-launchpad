import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyMotoPrecoFaixa,
  motoEstiloLabel,
  normalizeVehicleSegment,
} from "./vehicle-segment.ts";

Deno.test("segmento default carro", () => {
  assertEquals(normalizeVehicleSegment(null), "carro");
  assertEquals(normalizeVehicleSegment("moto"), "moto");
});

Deno.test("faixa preço moto", () => {
  assertEquals(classifyMotoPrecoFaixa(45_000), "ate_50");
  assertEquals(classifyMotoPrecoFaixa(80_000), "50_120");
  assertEquals(classifyMotoPrecoFaixa(150_000), "acima_120");
});

Deno.test("label estilo moto", () => {
  assertEquals(motoEstiloLabel("trail"), "Trail / Big trail");
});
