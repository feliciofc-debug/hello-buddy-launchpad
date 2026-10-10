import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  correctProductColors,
  cutOutProductBackground,
  paintProductStudioBackground,
  productStudioPalette,
} from "./product-photo-studio.ts";

function solidImage(
  width: number,
  height: number,
  color: [number, number, number],
): Uint8Array {
  const bitmap = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bitmap.length; offset += 4) {
    bitmap[offset] = color[0];
    bitmap[offset + 1] = color[1];
    bitmap[offset + 2] = color[2];
    bitmap[offset + 3] = 255;
  }
  return bitmap;
}

Deno.test("produto é recortado e catálogo recebe fundo claro harmonizado", () => {
  const width = 20;
  const height = 20;
  const bitmap = solidImage(width, height, [18, 20, 24]);
  for (let y = 4; y < 17; y++) {
    for (let x = 6; x < 14; x++) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = 55;
      bitmap[offset + 1] = 135;
      bitmap[offset + 2] = 225;
    }
  }
  const cutout = cutOutProductBackground({ width, height, bitmap });
  assert(cutout.segmented);
  assert(cutout.removedRatio > 0.4);
  assertEquals(cutout.bitmap[3], 0);
  const productOffset = (10 * width + 10) * 4;
  assertEquals([...cutout.bitmap.slice(productOffset, productOffset + 4)], [
    55,
    135,
    225,
    255,
  ]);

  const studio = {
    width,
    height,
    bitmap: solidImage(width, height, [0, 0, 0]),
  };
  paintProductStudioBackground(studio, "catalogo", "#60A5FA");
  assert(studio.bitmap[0] > 200);
  assert(studio.bitmap[1] > 200);
  assert(studio.bitmap[2] > 200);
  const palette = productStudioPalette("catalogo", "#60A5FA");
  assert(palette.top[2] > palette.top[0]);
});

Deno.test("falha conservadora no recorte preserva a foto original", () => {
  const width = 8;
  const height = 8;
  const bitmap = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = x * 31;
      bitmap[offset + 1] = y * 31;
      bitmap[offset + 2] = (x + y) * 15;
      bitmap[offset + 3] = 255;
    }
  }
  const cutout = cutOutProductBackground({ width, height, bitmap });
  assertEquals(cutout.segmented, false);
  assertEquals(cutout.bitmap, bitmap);
});

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
