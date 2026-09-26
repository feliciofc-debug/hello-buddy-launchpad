import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { findLogoContentBounds, trimLogoImage } from "./logo-image-trim.ts";

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

Deno.test("logo recortada é salva em PNG e formato não suportado fica intacto", async () => {
  const image = new Image(100, 80);
  image.fill(0xffffffff);
  image.drawBox(25, 30, 50, 20, 0x14202cff);
  const originalPng = new Uint8Array(await image.encode());
  const processed = await trimLogoImage(originalPng, "image/png");
  assertEquals(processed.trimmed, true);
  assertEquals(processed.mime, "image/png");
  const decoded = await Image.decode(processed.bytes);
  assertEquals([decoded.width, decoded.height], [54, 22]);

  const webp = new Uint8Array([1, 2, 3, 4]);
  const untouched = await trimLogoImage(webp, "image/webp");
  assertEquals(untouched, { bytes: webp, mime: "image/webp", trimmed: false });
});
