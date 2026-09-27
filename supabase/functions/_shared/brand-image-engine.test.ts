import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  applyBrandLogo,
  calculateLogoPlacement,
  removeSolidLogoBackground,
  shouldApplyBranding,
} from "./brand-image-engine.ts";

function pixel(image: Image, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [
    image.bitmap[offset],
    image.bitmap[offset + 1],
    image.bitmap[offset + 2],
    image.bitmap[offset + 3],
  ];
}

Deno.test("posição e tamanho da logo se adaptam a proporções diferentes", () => {
  const square = calculateLogoPlacement(1080, 1080, 400, 120);
  const story = calculateLogoPlacement(1080, 1920, 400, 120);
  const landscape = calculateLogoPlacement(1600, 900, 400, 120);
  assertEquals(square.x, 49);
  assertEquals(square.y, 49);
  assert(square.width >= 172 && square.width <= 216);
  assertEquals(story.x, 49);
  assert(story.width >= 172 && story.width <= 216);
  assert(landscape.x >= 64 && landscape.x <= 72);
  assert(landscape.width >= 256 && landscape.width <= 320);
});

Deno.test("remove fundo sólido conectado às bordas sem apagar a marca", () => {
  const width = 80;
  const height = 40;
  const bitmap = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 12; y < 28; y++) {
    for (let x = 20; x < 60; x++) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = 20;
      bitmap[offset + 1] = 80;
      bitmap[offset + 2] = 180;
    }
  }
  const result = removeSolidLogoBackground(bitmap, width, height);
  assertEquals(result.removed, true);
  assertEquals(result.bitmap[3], 0);
  assertEquals(result.bitmap[((20 * width + 40) * 4) + 3], 255);
});

Deno.test("usa painel translúcido quando o fundo da logo não pode ser removido", async () => {
  const base = new Image(500, 500);
  base.fill(0xeeeeeeff);
  const logo = new Image(160, 60);
  logo.fill(0xffffffff);
  logo.drawBox(0, 0, 20, 20, 0x111111ff);
  logo.drawBox(140, 40, 20, 20, 0x222222ff);
  logo.drawBox(45, 20, 70, 20, 0xcc2233ff);
  const result = await applyBrandLogo(
    new Uint8Array(await base.encode()),
    new Uint8Array(await logo.encode()),
  );
  assertEquals(result.backgroundRemoved, false);
  assertEquals(result.panelUsed, true);
});

Deno.test("aplica logo depois do enquadramento final de feed e story", async () => {
  const base = new Image(1200, 700);
  base.fill(0x224466ff);
  const logo = new Image(220, 80);
  logo.fill(0x00aa44ff);
  const baseBytes = new Uint8Array(await base.encode());
  const logoBytes = new Uint8Array(await logo.encode());

  for (const [format, dimensions] of [
    ["feed", [1080, 1080]],
    ["story", [1080, 1920]],
  ] as const) {
    const result = await applyBrandLogo(baseBytes, logoBytes, { format });
    assertEquals([result.width, result.height], dimensions);
    const decoded = await Image.decode(result.bytes);
    const center = pixel(
      decoded,
      result.placement.x + Math.floor(result.placement.width / 2),
      result.placement.y + Math.floor(result.placement.height / 2),
    );
    assert(center[1] > center[0]);
  }
});

Deno.test("sem logo e sem cores não aplica marca", () => {
  assertEquals(shouldApplyBranding({ useLogo: false, hasLogo: false, colors: [] }), false);
  assertEquals(shouldApplyBranding({ useLogo: true, hasLogo: true, colors: [] }), true);
});
