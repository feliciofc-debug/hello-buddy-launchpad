import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type BrandImageFormat = "original" | "feed" | "story";

export type LogoPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
};

export type BrandImageResult = {
  bytes: Uint8Array;
  width: number;
  height: number;
  placement: LogoPlacement;
  backgroundRemoved: boolean;
  panelUsed: boolean;
};

const FEED_SIZE = 1080;
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
let resvgReady: Promise<{
  Resvg: new (svg: Uint8Array | string, options?: Record<string, unknown>) => {
    render(): { asPng(): Uint8Array };
  };
}> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateLogoPlacement(
  imageWidth: number,
  imageHeight: number,
  logoWidth: number,
  logoHeight: number,
): LogoPlacement {
  const margin = clamp(Math.round(imageWidth * 0.045), 18, 72);
  let width = clamp(Math.round(imageWidth * 0.18), 96, 360);
  let height = Math.max(1, Math.round(width * logoHeight / Math.max(1, logoWidth)));
  const maxHeight = Math.round(imageHeight * 0.15);
  if (height > maxHeight) {
    const scale = maxHeight / height;
    width = Math.max(1, Math.round(width * scale));
    height = maxHeight;
  }
  return { x: margin, y: margin, width, height, margin };
}

function colorDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

function pixelRgb(bitmap: Uint8ClampedArray, offset: number): [number, number, number] {
  return [bitmap[offset], bitmap[offset + 1], bitmap[offset + 2]];
}

export function removeSolidLogoBackground(
  bitmap: Uint8ClampedArray,
  width: number,
  height: number,
): { bitmap: Uint8ClampedArray; removed: boolean; alreadyTransparent: boolean } {
  const output = new Uint8ClampedArray(bitmap);
  let transparent = 0;
  for (let i = 3; i < output.length; i += 4) {
    if (output[i] < 245) transparent++;
  }
  if (transparent / Math.max(1, width * height) > 0.025) {
    return { bitmap: output, removed: false, alreadyTransparent: true };
  }

  const cornerOffsets = [
    0,
    (width - 1) * 4,
    ((height - 1) * width) * 4,
    ((height * width) - 1) * 4,
  ];
  const corners = cornerOffsets.map((offset) => pixelRgb(output, offset));
  if (corners.some((color) => colorDistance(color, corners[0]) > 24)) {
    return { bitmap: output, removed: false, alreadyTransparent: false };
  }
  const background: [number, number, number] = [
    Math.round(corners.reduce((sum, color) => sum + color[0], 0) / corners.length),
    Math.round(corners.reduce((sum, color) => sum + color[1], 0) / corners.length),
    Math.round(corners.reduce((sum, color) => sum + color[2], 0) / corners.length),
  ];

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width, y * width + width - 1);
  }

  let removed = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (visited[index]) continue;
    visited[index] = 1;
    const offset = index * 4;
    if (colorDistance(pixelRgb(output, offset), background) > 38) continue;
    output[offset + 3] = 0;
    removed++;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) queue.push(index - 1);
    if (x + 1 < width) queue.push(index + 1);
    if (y > 0) queue.push(index - width);
    if (y + 1 < height) queue.push(index + width);
  }

  const ratio = removed / Math.max(1, width * height);
  if (ratio < 0.03 || ratio > 0.92) {
    return { bitmap: new Uint8ClampedArray(bitmap), removed: false, alreadyTransparent: false };
  }
  return { bitmap: output, removed: true, alreadyTransparent: false };
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);
}

export function extractDominantLogoColors(
  bitmap: Uint8ClampedArray,
  width: number,
  height: number,
  limit = 4,
): string[] {
  const colors = new Map<string, number>();
  const step = Math.max(1, Math.floor(Math.sqrt(width * height / 5000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      if (bitmap[offset + 3] < 100) continue;
      const r = bitmap[offset];
      const g = bitmap[offset + 1];
      const b = bitmap[offset + 2];
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (luminance < 0.07 || luminance > 0.94 || saturation(r, g, b) < 0.18) continue;
      const quantized = [r, g, b].map((value) => Math.round(value / 24) * 24)
        .map((value) => clamp(value, 0, 255));
      const hex = "#" + quantized.map((value) => value.toString(16).padStart(2, "0")).join("");
      colors.set(hex, (colors.get(hex) ?? 0) + 1);
    }
  }
  return [...colors.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, limit);
}

export async function extractDominantLogoColorsFromBytes(bytes: Uint8Array): Promise<string[]> {
  try {
    const image = await Image.decode(bytes);
    return extractDominantLogoColors(image.bitmap, image.width, image.height);
  } catch {
    return [];
  }
}

function areaLuminance(image: Image, placement: LogoPlacement): number {
  let total = 0;
  let count = 0;
  const right = Math.min(image.width, placement.x + placement.width);
  const bottom = Math.min(image.height, placement.y + placement.height);
  const step = Math.max(1, Math.floor(Math.min(placement.width, placement.height) / 20));
  for (let y = placement.y; y < bottom; y += step) {
    for (let x = placement.x; x < right; x += step) {
      const offset = (y * image.width + x) * 4;
      const bitmap = image.bitmap;
      total += (0.2126 * bitmap[offset] + 0.7152 * bitmap[offset + 1] + 0.0722 * bitmap[offset + 2]) / 255;
      count++;
    }
  }
  return count ? total / count : 0.5;
}

function drawRoundedPanel(
  image: Image,
  placement: LogoPlacement,
  lightArea: boolean,
): void {
  const padding = Math.max(10, Math.round(placement.width * 0.08));
  const x0 = Math.max(0, placement.x - padding);
  const y0 = Math.max(0, placement.y - padding);
  const x1 = Math.min(image.width, placement.x + placement.width + padding);
  const y1 = Math.min(image.height, placement.y + placement.height + padding);
  const radius = Math.max(8, Math.round(Math.min(x1 - x0, y1 - y0) * 0.16));
  const target = lightArea ? [12, 18, 28] : [250, 250, 250];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius - 1));
      const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius - 1));
      if (dx * dx + dy * dy > radius * radius) continue;
      const edge = Math.min(
        1,
        Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / Math.max(1, padding),
      );
      const alpha = 0.18 + edge * 0.18;
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        image.bitmap[offset + channel] = Math.round(
          image.bitmap[offset + channel] * (1 - alpha) + target[channel] * alpha,
        );
      }
    }
  }
}

function drawSubtleShadow(image: Image, logo: Image, x: number, y: number): void {
  const shadow = new Image(logo.width, logo.height);
  const dark = areaLuminance(image, {
    x,
    y,
    width: logo.width,
    height: logo.height,
    margin: 0,
  }) > 0.55;
  const color = dark ? [0, 0, 0] : [255, 255, 255];
  for (let offset = 0; offset < logo.bitmap.length; offset += 4) {
    shadow.bitmap[offset] = color[0];
    shadow.bitmap[offset + 1] = color[1];
    shadow.bitmap[offset + 2] = color[2];
    shadow.bitmap[offset + 3] = Math.round(logo.bitmap[offset + 3] * 0.24);
  }
  image.composite(shadow, x + 2, y + 3);
}

function logoLuminance(image: Image): number {
  let total = 0;
  let weight = 0;
  for (let offset = 0; offset < image.bitmap.length; offset += 4) {
    const alpha = image.bitmap[offset + 3] / 255;
    if (alpha < 0.05) continue;
    total += (
      0.2126 * image.bitmap[offset]
      + 0.7152 * image.bitmap[offset + 1]
      + 0.0722 * image.bitmap[offset + 2]
    ) / 255 * alpha;
    weight += alpha;
  }
  return weight ? total / weight : 0.5;
}

function fitBaseImage(base: Image, format: BrandImageFormat): Image {
  if (format === "original") return base;
  const targetWidth = format === "story" ? STORY_WIDTH : FEED_SIZE;
  const targetHeight = format === "story" ? STORY_HEIGHT : FEED_SIZE;
  const scale = Math.max(targetWidth / base.width, targetHeight / base.height);
  const resizedWidth = Math.max(1, Math.round(base.width * scale));
  const resizedHeight = Math.max(1, Math.round(base.height * scale));
  base.resize(resizedWidth, resizedHeight);
  const x = Math.max(0, Math.floor((resizedWidth - targetWidth) / 2));
  const y = Math.max(0, Math.floor((resizedHeight - targetHeight) / 2));
  return base.crop(x, y, targetWidth, targetHeight);
}

async function decodeLogo(logoBytes: Uint8Array): Promise<Image> {
  try {
    return await Image.decode(logoBytes);
  } catch (error) {
    const prefix = new TextDecoder().decode(logoBytes.subarray(0, 300));
    if (!/<svg\b/i.test(prefix)) throw error;
    if (!resvgReady) {
      resvgReady = (async () => {
        const module = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
        const wasm = await fetch(
          "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
        ).then((response) => response.arrayBuffer());
        await module.initWasm(wasm);
        return { Resvg: module.Resvg };
      })();
    }
    const { Resvg } = await resvgReady;
    const png = new Resvg(logoBytes, {
      fitTo: { mode: "width", value: 800 },
    }).render().asPng();
    return await Image.decode(png);
  }
}

export async function applyBrandLogo(
  baseBytes: Uint8Array,
  logoBytes: Uint8Array,
  options: { format?: BrandImageFormat } = {},
): Promise<BrandImageResult> {
  let base = await Image.decode(baseBytes);
  base = fitBaseImage(base, options.format ?? "original");
  let logo = await decodeLogo(logoBytes);
  const cleaned = removeSolidLogoBackground(logo.bitmap, logo.width, logo.height);
  logo.bitmap.set(cleaned.bitmap);

  const placement = calculateLogoPlacement(base.width, base.height, logo.width, logo.height);
  logo.resize(placement.width, placement.height);
  const localLuminance = areaLuminance(base, placement);
  const lowContrast = Math.abs(localLuminance - logoLuminance(logo)) < 0.28;
  const panelUsed = !cleaned.removed && !cleaned.alreadyTransparent || lowContrast;
  if (panelUsed) drawRoundedPanel(base, placement, localLuminance > 0.55);
  drawSubtleShadow(base, logo, placement.x, placement.y);
  base.composite(logo, placement.x, placement.y);

  return {
    bytes: new Uint8Array(await base.encode(6)),
    width: base.width,
    height: base.height,
    placement,
    backgroundRemoved: cleaned.removed,
    panelUsed,
  };
}

export function buildBrandGenerationGuidance(
  colors: string[],
  options: { hasLogo: boolean; hasBasePhoto: boolean },
): string {
  const palette = colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 4);
  const lines = [
    options.hasLogo
      ? "Reserve uma área de espaço negativo limpa no canto superior esquerdo, com cerca de 25% da largura por 15% da altura, sem objetos importantes, sem texto e sem logos. A logo original será aplicada depois da geração."
      : "",
    palette.length
      ? `Harmonize iluminação, fundo e detalhes com esta paleta de marca: ${palette.join(", ")}. Não escreva os códigos na imagem.`
      : "",
    options.hasBasePhoto
      ? "A PRIMEIRA foto é a base real: preserve fielmente o produto, pessoa ou local principal. Crie ou refine apenas o ambiente, fundo, luz e acabamento ao redor, sem trocar sua identidade."
      : "",
    "Não desenhe, reproduza, invente ou estilize logotipos. Não inclua texto, selo ou marca d'água.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function shouldApplyBranding(input: {
  useLogo?: boolean;
  hasLogo?: boolean;
  colors?: string[];
}): boolean {
  return Boolean(
    (input.useLogo && input.hasLogo) || (input.colors && input.colors.length > 0),
  );
}
