import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { correctProductColors } from "./product-photo-studio.ts";

Deno.test("correção determinística não altera transparência nem formato", () => {
  const bitmap = new Uint8Array([
    20,
    30,
    40,
    0,
    100,
    120,
    180,
    255,
  ]);
  const corrected = correctProductColors(bitmap);
  assertEquals(corrected.length, bitmap.length);
  assertEquals(corrected[3], 0);
  assertEquals(corrected[7], 255);
});
