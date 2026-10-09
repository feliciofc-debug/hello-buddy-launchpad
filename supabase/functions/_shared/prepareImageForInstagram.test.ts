import {
  assert,
  assertEquals,
  assertGreaterOrEqual,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  normalizeInstagramImageBytes,
  normalizeInstagramImageFromUrl,
} from "./prepareImageForInstagram.ts";

Deno.test("PNG transparente vira JPEG sRGB com fundo branco e lado mínimo", async () => {
  const source = new Image(100, 100);
  source.fill(0x00000000);
  const prepared = await normalizeInstagramImageBytes(await source.encode());
  assertEquals(Array.from(prepared.bytes.slice(0, 3)), [0xff, 0xd8, 0xff]);
  assertGreaterOrEqual(prepared.width, 320);
  assertGreaterOrEqual(prepared.height, 320);
  assert(prepared.bytes.byteLength <= 8 * 1024 * 1024);
  const decoded = await Image.decode(prepared.bytes);
  const pixel = decoded.getPixelAt(1, 1);
  assert(((pixel >> 24) & 0xff) > 245);
  assert(((pixel >> 16) & 0xff) > 245);
  assert(((pixel >> 8) & 0xff) > 245);
});

Deno.test("imagem fora de 4:5–1.91:1 recebe moldura sem corte", async () => {
  const source = new Image(200, 1000);
  source.fill(0xf36812ff);
  const prepared = await normalizeInstagramImageBytes(await source.encode());
  assertEquals(prepared.framed, true);
  assertEquals([prepared.width, prepared.height], [1080, 1080]);
  const decoded = await Image.decode(prepared.bytes);
  const center = decoded.getPixelAt(540, 540);
  assert(((center >> 24) & 0xff) > 220, "produto central foi preservado");
});

Deno.test("WebP também é reencodado como JPEG público compatível", async () => {
  const webp = Uint8Array.from(
    atob("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"),
    (char) => char.charCodeAt(0),
  );
  const converted = new Image(640, 640);
  converted.fill(0xf36812ff);
  const convertedPng = await converted.encode();
  let requests = 0;
  const prepared = await normalizeInstagramImageFromUrl(
    "https://cdn.example/carro.webp",
    (() => {
      requests += 1;
      return Promise.resolve(
        new Response(requests === 1 ? webp : convertedPng, { status: 200 }),
      );
    }) as typeof fetch,
  );
  assertEquals(requests, 2);
  assertEquals(Array.from(prepared.bytes.slice(0, 3)), [0xff, 0xd8, 0xff]);
  assertGreaterOrEqual(prepared.width, 320);
  assert(prepared.bytes.byteLength <= 8 * 1024 * 1024);
});
