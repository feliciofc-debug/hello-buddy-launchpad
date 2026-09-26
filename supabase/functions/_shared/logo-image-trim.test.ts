import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findLogoContentBounds } from "./logo-image-trim.ts";

Deno.test("recorta branco/transparente e preserva cerca de 4% de respiro", () => {
  const width = 100;
  const height = 80;
  const bitmap = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 30; y < 50; y++) {
    for (let x = 25; x < 75; x++) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = 20;
      bitmap[offset + 1] = 30;
      bitmap[offset + 2] = 40;
      bitmap[offset + 3] = 255;
    }
  }
  assertEquals(findLogoContentBounds(bitmap, width, height), {
    x: 23,
    y: 29,
    width: 54,
    height: 22,
  });
});
