import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  deriveLogoVariant,
  deriveDarkBackgroundLogo,
  LOGO_BACKGROUND_WARNING,
  removeSolidLogoBackground,
} from "./logo-background.ts";

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  const typeBytes = new TextEncoder().encode(type);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length)));
  return output;
}

async function rgbPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
): Promise<Uint8Array> {
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      raw.set(pixel(x, y), row + 1 + x * 3);
    }
  }
  const compressed = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array()),
  ];
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function setPixel(
  image: Image,
  x: number,
  y: number,
  rgba: [number, number, number, number],
) {
  const offset = (y * image.width + x) * 4;
  image.bitmap.set(rgba, offset);
}

Deno.test("fundo branco sólido conectado à borda vira transparente", async () => {
  const image = new Image(40, 30);
  image.fill(Image.rgbToColor(255, 255, 255));
  for (let y = 8; y < 22; y++) {
    for (let x = 10; x < 30; x++) setPixel(image, x, y, [20, 20, 20, 255]);
  }
  const result = await removeSolidLogoBackground(
    new Uint8Array(await image.encode()),
    "image/png",
  );
  assertEquals(result.changed, true);
  assertEquals(result.mime, "image/png");
  const decoded = await Image.decode(result.bytes);
  assertEquals(decoded.bitmap[3], 0);
  assert(decoded.bitmap.some((value, index) => index % 4 === 3 && value === 255));
});

Deno.test("PNG RGB 1778x400 sem alfa remove fundo branco", async () => {
  const bytes = await rgbPng(1778, 400, (x, y) =>
    x > 400 && x < 1350 && y > 100 && y < 300
      ? [34, 34, 36]
      : [255, 255, 255]
  );
  const result = await removeSolidLogoBackground(bytes, "image/png");
  assertEquals(result.changed, true);
  const decoded = await Image.decode(result.bytes);
  assertEquals(decoded.bitmap[3], 0);
  assert(decoded.bitmap.some((value, index) => index % 4 === 3 && value === 255));
});

Deno.test("JPEG com fundo branco vira PNG transparente", async () => {
  const image = new Image(120, 50);
  image.fill(Image.rgbToColor(255, 255, 255));
  image.drawBox(30, 12, 60, 26, Image.rgbToColor(30, 30, 32));
  const jpeg = new Uint8Array(await image.encodeJPEG(90));
  const result = await removeSolidLogoBackground(jpeg, "image/jpeg");
  assertEquals(result.changed, true);
  assertEquals(result.mime, "image/png");
  const decoded = await Image.decode(result.bytes);
  assertEquals(decoded.bitmap[3], 0);
});

Deno.test("logo já transparente não é alterada", async () => {
  const image = new Image(24, 24);
  image.fill(Image.rgbaToColor(0, 0, 0, 0));
  for (let y = 7; y < 17; y++) {
    for (let x = 5; x < 19; x++) setPixel(image, x, y, [0, 0, 0, 255]);
  }
  const bytes = new Uint8Array(await image.encode());
  const result = await removeSolidLogoBackground(bytes, "image/png");
  assertEquals(result.changed, false);
  assertEquals(result.warning, null);
  assertEquals(result.bytes, bytes);
});

Deno.test("borda irregular preserva imagem e devolve aviso", async () => {
  const image = new Image(30, 30);
  image.fill(Image.rgbToColor(255, 255, 255));
  for (let x = 0; x < 30; x++) {
    setPixel(image, x, 0, x % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]);
    setPixel(image, x, 29, x % 2 ? [0, 255, 0, 255] : [255, 255, 0, 255]);
  }
  const result = await removeSolidLogoBackground(
    new Uint8Array(await image.encode()),
    "image/png",
  );
  assertEquals(result.changed, false);
  assertEquals(result.warning, LOGO_BACKGROUND_WARNING);
});

Deno.test("variante escura troca preto por branco e mantém laranja", async () => {
  const image = new Image(40, 20);
  image.fill(Image.rgbaToColor(0, 0, 0, 0));
  for (let y = 4; y < 16; y++) {
    for (let x = 3; x < 20; x++) setPixel(image, x, y, [10, 10, 10, 255]);
    for (let x = 20; x < 37; x++) setPixel(image, x, y, [243, 104, 18, 255]);
  }
  const result = await deriveDarkBackgroundLogo(
    new Uint8Array(await image.encode()),
  );
  assertEquals(result.generated, true);
  const decoded = await Image.decode(result.bytes);
  const padding = Math.floor((decoded.width - image.width) / 2);
  const blackOffset = ((8 + padding) * decoded.width + 8 + padding) * 4;
  const orangeOffset = ((8 + padding) * decoded.width + 28 + padding) * 4;
  assertEquals([...decoded.bitmap.slice(blackOffset, blackOffset + 3)], [
    255,
    255,
    255,
  ]);
  assertEquals([...decoded.bitmap.slice(orangeOffset, orangeOffset + 3)], [
    243,
    104,
    18,
  ]);
});

Deno.test("variantes preservam cor e criam sombra ou brilho sem caixa", async () => {
  const image = new Image(120, 40);
  image.fill(Image.rgbaToColor(0, 0, 0, 0));
  for (let y = 10; y < 30; y++) {
    for (let x = 8; x < 75; x++) setPixel(image, x, y, [34, 34, 36, 255]);
    for (let x = 82; x < 112; x++) setPixel(image, x, y, [243, 104, 18, 255]);
  }
  const bytes = new Uint8Array(await image.encode());
  for (
    const variant of [
      "video",
      "dark_background",
      "light_background",
    ] as const
  ) {
    const result = await deriveLogoVariant(bytes, variant);
    assert(result.generated);
    const decoded = await Image.decode(result.bytes);
    const padding = Math.floor((decoded.width - image.width) / 2);
    const neutral = ((20 + padding) * decoded.width + 30 + padding) * 4;
    const orange = ((20 + padding) * decoded.width + 95 + padding) * 4;
    assertEquals(
      [...decoded.bitmap.slice(neutral, neutral + 3)],
      variant === "light_background" ? [21, 21, 23] : [255, 255, 255],
    );
    assertEquals([...decoded.bitmap.slice(orange, orange + 3)], [243, 104, 18]);
    assertEquals(decoded.bitmap[3], 0);
    assert(decoded.bitmap.some((alpha, index) =>
      index % 4 === 3 && alpha > 0 && alpha < 255
    ));
  }
});
