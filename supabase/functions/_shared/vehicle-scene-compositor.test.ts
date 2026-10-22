import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  compositeVehicleOriginalPixels,
  enhanceVehiclePaintPreservingDetails,
  validateVehicleMeanColor,
  vehicleBackgroundOnlyPrompt,
  vehicleSegmentationMaskPrompt,
} from "./vehicle-scene-compositor.ts";

Deno.test("FIX-VEIC-3.3 — composição preserva pixels e cor média do veículo", async () => {
  const original = new Image(40, 20);
  const background = new Image(40, 20);
  const mask = new Image(40, 20);
  original.fill(0x6b7078ff);
  background.fill(0xe8a04bff);
  mask.fill(0x000000ff);
  for (let y = 5; y < 16; y++) {
    for (let x = 8; x < 32; x++) {
      mask.setPixelAt(x + 1, y + 1, 0xffffffff);
    }
  }
  const result = await compositeVehicleOriginalPixels(
    new Uint8Array(await original.encode()),
    new Uint8Array(await background.encode()),
    new Uint8Array(await mask.encode()),
  );
  const output = await Image.decode(result.bytes);
  assertEquals(output.getPixelAt(20, 10), original.getPixelAt(20, 10));
  assert(result.meanColorDelta <= 2);
  assert(result.vehicleCoverage > 0.2);
});

Deno.test("FIX-VEIC-3.3 — prompts separam fundo e máscara sem redesenhar carro", () => {
  const background = vehicleBackgroundOnlyPrompt(
    "estrada com pôr do sol e montanhas",
  );
  assert(background.includes("SOMENTE o fundo"));
  assert(background.includes("Remova totalmente o veículo"));
  const mask = vehicleSegmentationMaskPrompt();
  assert(mask.includes("veículo inteiro"));
  assert(mask.includes("BRANCO puro"));
  assert(mask.includes("restante em PRETO puro"));
});

Deno.test("FIX-VEIC-3.3 — valida desvio de cor média em melhoria", async () => {
  const source = new Image(30, 20);
  const faithful = new Image(30, 20);
  const repainted = new Image(30, 20);
  const mask = new Image(30, 20);
  source.fill(0x787d84ff);
  faithful.fill(0x80858cff);
  repainted.fill(0x202020ff);
  mask.fill(0x000000ff);
  for (let y = 5; y < 15; y++) {
    for (let x = 6; x < 24; x++) {
      mask.setPixelAt(x + 1, y + 1, 0xffffffff);
    }
  }
  const sourceBytes = new Uint8Array(await source.encode());
  const maskBytes = new Uint8Array(await mask.encode());
  const valid = await validateVehicleMeanColor(
    sourceBytes,
    new Uint8Array(await faithful.encode()),
    maskBytes,
  );
  const invalid = await validateVehicleMeanColor(
    sourceBytes,
    new Uint8Array(await repainted.encode()),
    maskBytes,
  );
  assertEquals(valid.valid, true);
  assertEquals(invalid.valid, false);
});

Deno.test("FIX-VEIC-3.3 — realce por pixel mantém risco visível", async () => {
  const source = new Image(30, 20);
  const mask = new Image(30, 20);
  source.fill(0x777777ff);
  mask.fill(0x000000ff);
  for (let y = 5; y < 15; y++) {
    for (let x = 6; x < 24; x++) {
      mask.setPixelAt(x + 1, y + 1, 0xffffffff);
    }
  }
  source.setPixelAt(15, 10, 0x202020ff);
  const enhanced = await Image.decode(
    await enhanceVehiclePaintPreservingDetails(
      new Uint8Array(await source.encode()),
      new Uint8Array(await mask.encode()),
    ),
  );
  const scratch = enhanced.getPixelAt(15, 10);
  const paint = enhanced.getPixelAt(14, 10);
  assert(scratch !== paint);
});
