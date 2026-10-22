import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type VehicleCompositeResult = {
  bytes: Uint8Array;
  vehicleCoverage: number;
  meanColorDelta: number;
};

export type VehicleColorValidation = {
  valid: boolean;
  meanColorDelta: number;
  vehicleCoverage: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function maskAlpha(r: number, g: number, b: number): number {
  const luminance = (r + g + b) / 3;
  return Math.round(clamp((luminance - 72) / 96, 0, 1) * 255);
}

export async function validateVehicleMeanColor(
  sourceBytes: Uint8Array,
  editedBytes: Uint8Array,
  maskBytes: Uint8Array,
  maxMeanDelta = 14,
): Promise<VehicleColorValidation> {
  const source = await Image.decode(sourceBytes);
  const edited = await Image.decode(editedBytes);
  const mask = await Image.decode(maskBytes);
  if (edited.width !== source.width || edited.height !== source.height) {
    edited.resize(source.width, source.height);
  }
  if (mask.width !== source.width || mask.height !== source.height) {
    mask.resize(source.width, source.height);
  }
  const sourceMean = [0, 0, 0];
  const editedMean = [0, 0, 0];
  let selected = 0;
  for (let i = 0; i < source.bitmap.length; i += 4) {
    if (
      maskAlpha(mask.bitmap[i], mask.bitmap[i + 1], mask.bitmap[i + 2]) < 200
    ) continue;
    selected++;
    for (let channel = 0; channel < 3; channel++) {
      sourceMean[channel] += source.bitmap[i + channel];
      editedMean[channel] += edited.bitmap[i + channel];
    }
  }
  const coverage = selected / Math.max(1, source.width * source.height);
  if (coverage < 0.02 || coverage > 0.85) {
    return {
      valid: false,
      meanColorDelta: Number.POSITIVE_INFINITY,
      vehicleCoverage: coverage,
    };
  }
  const meanColorDelta = sourceMean.reduce(
    (sum, value, channel) =>
      sum + Math.abs(value / selected - editedMean[channel] / selected),
    0,
  ) / 3;
  return {
    valid: meanColorDelta <= maxMeanDelta,
    meanColorDelta,
    vehicleCoverage: coverage,
  };
}

export async function enhanceVehiclePaintPreservingDetails(
  sourceBytes: Uint8Array,
  maskBytes: Uint8Array,
): Promise<Uint8Array> {
  const source = await Image.decode(sourceBytes);
  const mask = await Image.decode(maskBytes);
  if (mask.width !== source.width || mask.height !== source.height) {
    mask.resize(source.width, source.height);
  }
  for (let i = 0; i < source.bitmap.length; i += 4) {
    const alpha = maskAlpha(
      mask.bitmap[i],
      mask.bitmap[i + 1],
      mask.bitmap[i + 2],
    ) / 255;
    if (alpha <= 0) continue;
    for (let channel = 0; channel < 3; channel++) {
      const value = source.bitmap[i + channel];
      const enhanced = clamp((value - 128) * 1.035 + 132, 0, 255);
      source.bitmap[i + channel] = Math.round(
        value * (1 - alpha) + enhanced * alpha,
      );
    }
  }
  return new Uint8Array(await source.encode(6));
}

/**
 * Compõe pixels da foto original sobre um fundo gerado. A IA fornece somente
 * fundo e máscara; nunca recebe autorização para redesenhar o veículo.
 */
export async function compositeVehicleOriginalPixels(
  originalBytes: Uint8Array,
  backgroundBytes: Uint8Array,
  maskBytes: Uint8Array,
): Promise<VehicleCompositeResult> {
  const original = await Image.decode(originalBytes);
  const background = await Image.decode(backgroundBytes);
  const mask = await Image.decode(maskBytes);
  if (
    background.width !== original.width ||
    background.height !== original.height
  ) {
    background.resize(original.width, original.height);
  }
  if (mask.width !== original.width || mask.height !== original.height) {
    mask.resize(original.width, original.height);
  }

  const foreground = new Image(original.width, original.height);
  let selected = 0;
  let opaque = 0;
  let sourceR = 0;
  let sourceG = 0;
  let sourceB = 0;
  for (let i = 0; i < original.bitmap.length; i += 4) {
    const alpha = maskAlpha(
      mask.bitmap[i],
      mask.bitmap[i + 1],
      mask.bitmap[i + 2],
    );
    foreground.bitmap[i] = original.bitmap[i];
    foreground.bitmap[i + 1] = original.bitmap[i + 1];
    foreground.bitmap[i + 2] = original.bitmap[i + 2];
    foreground.bitmap[i + 3] = alpha;
    if (alpha >= 128) selected++;
    if (alpha >= 250) {
      opaque++;
      sourceR += original.bitmap[i];
      sourceG += original.bitmap[i + 1];
      sourceB += original.bitmap[i + 2];
    }
  }
  const pixels = original.width * original.height;
  const vehicleCoverage = selected / Math.max(1, pixels);
  if (vehicleCoverage < 0.02 || vehicleCoverage > 0.85 || opaque < 100) {
    throw new Error("vehicle_mask_invalid");
  }

  background.composite(foreground, 0, 0);
  let outputR = 0;
  let outputG = 0;
  let outputB = 0;
  for (let i = 0; i < original.bitmap.length; i += 4) {
    if (foreground.bitmap[i + 3] < 250) continue;
    outputR += background.bitmap[i];
    outputG += background.bitmap[i + 1];
    outputB += background.bitmap[i + 2];
  }
  const meanColorDelta = (
    Math.abs(sourceR / opaque - outputR / opaque) +
    Math.abs(sourceG / opaque - outputG / opaque) +
    Math.abs(sourceB / opaque - outputB / opaque)
  ) / 3;
  if (meanColorDelta > 2) throw new Error("vehicle_color_changed");

  return {
    bytes: new Uint8Array(await background.encode(6)),
    vehicleCoverage,
    meanColorDelta,
  };
}

export function vehicleBackgroundOnlyPrompt(instruction: string): string {
  return `Crie SOMENTE o fundo fotorealista solicitado: "${instruction}".
A imagem de referência serve apenas para perspectiva, horizonte e iluminação.
Remova totalmente o veículo e reconstrua o espaço atrás dele.
Não inclua carro, moto, veículo, texto, logo, placa ou marca d'água.
Mantenha exatamente a proporção e o enquadramento da imagem de referência.`;
}

export function vehicleSegmentationMaskPrompt(): string {
  return `Gere uma máscara de segmentação binária da imagem de referência:
- veículo inteiro (lataria, vidros, rodas, pneus, retrovisores e placa) em BRANCO puro;
- todo o restante em PRETO puro;
- preserve exatamente posição, contorno e dimensões;
- sem sombra, fundo, texto, tons de cinza ou elementos extras.
Entregue somente a imagem da máscara, na mesma proporção da referência.`;
}
