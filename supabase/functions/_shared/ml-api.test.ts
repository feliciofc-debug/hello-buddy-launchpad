import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mlListingPackTryOrder } from "./ml-api.ts";

Deno.test("mlListingPackTryOrder — classic_first prioriza silver", () => {
  assertEquals(mlListingPackTryOrder("classic_first")[0], "silver");
});

Deno.test("mlListingPackTryOrder — destaque_first prioriza gold_premium", () => {
  assertEquals(mlListingPackTryOrder("destaque_first")[0], "gold_premium");
});
