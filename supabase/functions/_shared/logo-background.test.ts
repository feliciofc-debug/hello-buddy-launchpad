import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  deriveDarkBackgroundLogo,
  LOGO_BACKGROUND_WARNING,
  removeSolidLogoBackground,
} from "./logo-background.ts";

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
  const blackOffset = (8 * decoded.width + 8) * 4;
  const orangeOffset = (8 * decoded.width + 28) * 4;
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
