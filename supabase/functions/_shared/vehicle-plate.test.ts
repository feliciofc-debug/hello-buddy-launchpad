import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  brazilianPlatesEquivalent,
  equivalentBrazilianPlates,
  mercosulPlateToOld,
  normalizeBrazilianPlate,
  oldPlateToMercosul,
} from "./vehicle-plate.ts";

Deno.test("VEIC-WPP-1 — placa antiga e Mercosul são equivalentes", () => {
  assertEquals(normalizeBrazilianPlate("lmc-5764"), "LMC5764");
  assertEquals(oldPlateToMercosul("LMC5764"), "LMC5H64");
  assertEquals(mercosulPlateToOld("LMC5H64"), "LMC5764");
  assertEquals(equivalentBrazilianPlates("LMC5764"), [
    "LMC5764",
    "LMC5H64",
  ]);
  assertEquals(brazilianPlatesEquivalent("LMC5764", "LMC5H64"), true);
  assertEquals(brazilianPlatesEquivalent("LMC5764", "ABC1D23"), false);
});
