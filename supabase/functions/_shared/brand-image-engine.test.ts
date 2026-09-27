import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  applyBrandLogo,
  buildBrandGenerationGuidance,
  calculateLogoPlacement,
  removeSolidLogoBackground,
  selectLogoPlacement,
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

Deno.test("escolhe canto escuro quando o superior esquerdo é claro", () => {
  const image = new Image(500, 500);
  image.fill(0xeeeeeeff);
  image.drawBox(300, 300, 200, 200, 0x151820ff);
  const decision = selectLogoPlacement(image.bitmap, 500, 500, 180, 60);
  assertEquals(decision.placement.corner, "bottom-right");
  assertEquals(decision.useVignette, false);
});

Deno.test("remove cartão opaco com cantos transparentes e preserva ícone e letras", () => {
  const width = 200;
  const height = 80;
  const bitmap = new Uint8ClampedArray(width * height * 4);
  const fill = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: [number, number, number, number],
  ) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        bitmap.set(color, (y * width + x) * 4);
      }
    }
  };
  fill(10, 10, 190, 70, [24, 28, 36, 255]);
  fill(25, 24, 52, 56, [240, 150, 30, 255]);
  fill(68, 25, 168, 33, [255, 255, 255, 255]);
  fill(68, 43, 150, 51, [255, 255, 255, 255]);
  const result = removeSolidLogoBackground(bitmap, width, height);
  assertEquals(result.removed, true);
  assertEquals(result.bitmap[(12 * width + 12) * 4 + 3], 0);
  assertEquals(result.bitmap[(35 * width + 35) * 4 + 3], 255);
  assertEquals(result.bitmap[(28 * width + 100) * 4 + 3], 255);
});

Deno.test("não cria moldura em área escura e lisa", async () => {
  const base = new Image(500, 500);
  base.fill(0x151820ff);
  const logo = new Image(160, 60);
  logo.fill(0x00000000);
  for (let y = 15; y < 45; y++) {
    for (let x = 30; x < 130; x++) {
      logo.bitmap.set([240, 240, 240, 255], (y * logo.width + x) * 4);
    }
  }
  const result = await applyBrandLogo(
    new Uint8Array(await base.encode()),
    new Uint8Array(await logo.encode()),
  );
  assertEquals(result.panelUsed, false);
  assertEquals(result.vignetteUsed, false);
});

Deno.test("story mantém a logo fora da faixa inferior de dezoito por cento", () => {
  const image = new Image(1080, 1920);
  image.fill(0xeeeeeeff);
  image.drawBox(0, 1350, 1080, 570, 0x151820ff);
  const decision = selectLogoPlacement(
    image.bitmap,
    image.width,
    image.height,
    300,
    100,
    "story",
  );
  assert(decision.placement.y + decision.placement.height <= image.height * 0.82);
});

Deno.test("salvaguardas mantêm original quando remoção é menor que 3% ou maior que 92%", () => {
  const mostlyCard = new Uint8ClampedArray(100 * 60 * 4);
  for (let y = 5; y < 55; y++) {
    for (let x = 5; x < 95; x++) {
      mostlyCard.set([22, 24, 30, 255], (y * 100 + x) * 4);
    }
  }
  for (let y = 28; y < 32; y++) {
    for (let x = 46; x < 54; x++) {
      mostlyCard.set([255, 255, 255, 255], (y * 100 + x) * 4);
    }
  }
  assertEquals(removeSolidLogoBackground(mostlyCard, 100, 60).removed, false);

  const thinBorder = new Uint8ClampedArray(200 * 200 * 4);
  thinBorder.fill(255);
  for (let y = 1; y < 199; y++) {
    for (let x = 1; x < 199; x++) {
      thinBorder.set([180, 40, 60, 255], (y * 200 + x) * 4);
    }
  }
  assertEquals(removeSolidLogoBackground(thinBorder, 200, 200).removed, false);
});

Deno.test("aplica logo depois do enquadramento final de feed e story", async () => {
  const base = new Image(1200, 700);
  base.fill(0x224466ff);
  const logo = new Image(220, 80);
  logo.fill(0x00aa44ff);
  const baseBytes = new Uint8Array(await base.encode());
  const logoBytes = new Uint8Array(await logo.encode());

  const formats: Array<["feed" | "story", [number, number]]> = [
    ["feed", [1080, 1080]],
    ["story", [1080, 1920]],
  ];
  for (const [format, dimensions] of formats) {
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
  const guidance = buildBrandGenerationGuidance([], { hasLogo: true, hasBasePhoto: false });
  assert(guidance.includes("ESCURA e LISA"));
  assert(guidance.includes("sem luzes, janelas"));
});
