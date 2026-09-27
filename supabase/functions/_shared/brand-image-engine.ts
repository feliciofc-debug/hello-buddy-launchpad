import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type BrandImageFormat = "original" | "feed" | "story";
export type LogoCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type LogoPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
  corner: LogoCorner;
};

export type BrandImageResult = {
  bytes: Uint8Array;
  width: number;
  height: number;
  placement: LogoPlacement;
  backgroundRemoved: boolean;
  panelUsed: boolean;
  vignetteUsed: boolean;
};

export type LogoPlacementDecision = {
  placement: LogoPlacement;
  luminance: number;
  variance: number;
  edgeDensity: number;
  useVignette: boolean;
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
  return { x: margin, y: margin, width, height, margin, corner: "top-left" };
}

function luminanceAt(bitmap: Uint8ClampedArray, width: number, x: number, y: number): number {
  const offset = (y * width + x) * 4;
  return (
    0.2126 * bitmap[offset]
    + 0.7152 * bitmap[offset + 1]
    + 0.0722 * bitmap[offset + 2]
  ) / 255;
}

function placementMetrics(
  bitmap: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  placement: LogoPlacement,
): { luminance: number; variance: number; edgeDensity: number } {
  const padding = Math.max(8, Math.round(placement.width * 0.08));
  const x0 = clamp(placement.x - padding, 0, imageWidth - 1);
  const y0 = clamp(placement.y - padding, 0, imageHeight - 1);
  const x1 = clamp(placement.x + placement.width + padding, 1, imageWidth);
  const y1 = clamp(placement.y + placement.height + padding, 1, imageHeight);
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 28));
  const values: number[] = [];
  let edges = 0;
  let comparisons = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const value = luminanceAt(bitmap, imageWidth, x, y);
      values.push(value);
      if (x + step < x1) {
        if (Math.abs(value - luminanceAt(bitmap, imageWidth, x + step, y)) > 0.12) edges++;
        comparisons++;
      }
      if (y + step < y1) {
        if (Math.abs(value - luminanceAt(bitmap, imageWidth, x, y + step)) > 0.12) edges++;
        comparisons++;
      }
    }
  }
  const luminance = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - luminance) ** 2, 0)
    / Math.max(1, values.length);
  return {
    luminance,
    variance,
    edgeDensity: edges / Math.max(1, comparisons),
  };
}

export function selectLogoPlacement(
  bitmap: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  logoWidth: number,
  logoHeight: number,
  format: BrandImageFormat = "original",
): LogoPlacementDecision {
  const base = calculateLogoPlacement(imageWidth, imageHeight, logoWidth, logoHeight);
  const bottomEdge = format === "story"
    ? Math.floor(imageHeight * 0.82) - base.margin
    : imageHeight - base.margin;
  const placements: LogoPlacement[] = [
    { ...base, corner: "top-left" },
    { ...base, x: imageWidth - base.margin - base.width, corner: "top-right" },
    {
      ...base,
      y: Math.max(base.margin, bottomEdge - base.height),
      corner: "bottom-left",
    },
    {
      ...base,
      x: imageWidth - base.margin - base.width,
      y: Math.max(base.margin, bottomEdge - base.height),
      corner: "bottom-right",
    },
  ];
  const evaluated = placements.map((placement) => ({
    placement,
    ...placementMetrics(bitmap, imageWidth, imageHeight, placement),
  }));
  const darkCandidates = evaluated.filter((item) =>
    item.luminance <= 0.46
    && item.variance <= 0.055
    && item.edgeDensity <= 0.24
  );
  const candidates = darkCandidates.length ? darkCandidates : evaluated;
  const chosen = [...candidates].sort((a, b) => {
    const aComplexity = Math.sqrt(a.variance) + a.edgeDensity;
    const bComplexity = Math.sqrt(b.variance) + b.edgeDensity;
    const aCost = darkCandidates.length
      ? a.luminance * 0.58 + aComplexity * 0.42
      : aComplexity * 0.88 + a.luminance * 0.12;
    const bCost = darkCandidates.length
      ? b.luminance * 0.58 + bComplexity * 0.42
      : bComplexity * 0.88 + b.luminance * 0.12;
    return aCost - bCost;
  })[0];
  return {
    ...chosen,
    useVignette: darkCandidates.length === 0,
  };
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
  let opaque = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < width * height; index++) {
    const alpha = output[index * 4 + 3];
    if (alpha < 245) transparent++;
    if (alpha < 80) continue;
    opaque++;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!opaque || maxX < minX || maxY < minY) {
    return { bitmap: output, removed: false, alreadyTransparent: transparent > 0 };
  }

  const hasTransparentCorners = transparent / Math.max(1, width * height) > 0.025;
  const seeds: number[] = [];
  const boundaryColors: Array<[number, number, number]> = [];
  const addBoundary = (x: number, y: number) => {
    const index = y * width + x;
    const offset = index * 4;
    if (output[offset + 3] < 180) return;
    seeds.push(index);
    boundaryColors.push(pixelRgb(output, offset));
  };

  if (hasTransparentCorners) {
    for (let x = minX; x <= maxX; x++) {
      addBoundary(x, minY);
      if (maxY !== minY) addBoundary(x, maxY);
    }
    for (let y = minY + 1; y < maxY; y++) {
      addBoundary(minX, y);
      if (maxX !== minX) addBoundary(maxX, y);
    }
  } else {
    for (let x = 0; x < width; x++) {
      addBoundary(x, 0);
      if (height > 1) addBoundary(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      addBoundary(0, y);
      if (width > 1) addBoundary(width - 1, y);
    }
  }
  if (!boundaryColors.length) {
    return { bitmap: output, removed: false, alreadyTransparent: hasTransparentCorners };
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of boundaryColors) {
    const key = `${Math.round(r / 20)},${Math.round(g / 20)},${Math.round(b / 20)}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant || dominant.count / boundaryColors.length < 0.55) {
    return { bitmap: output, removed: false, alreadyTransparent: hasTransparentCorners };
  }
  const background: [number, number, number] = [
    Math.round(dominant.r / dominant.count),
    Math.round(dominant.g / dominant.count),
    Math.round(dominant.b / dominant.count),
  ];
  const matchingSeeds = seeds.filter((index) =>
    colorDistance(pixelRgb(output, index * 4), background) <= 34
  );
  const visited = new Uint8Array(width * height);
  const queue = [...matchingSeeds];
  let removed = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (visited[index]) continue;
    visited[index] = 1;
    const offset = index * 4;
    if (
      output[offset + 3] < 40
      || colorDistance(pixelRgb(output, offset), background) > 38
    ) continue;
    output[offset + 3] = 0;
    removed++;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > minX) queue.push(index - 1);
    if (x < maxX) queue.push(index + 1);
    if (y > minY) queue.push(index - width);
    if (y < maxY) queue.push(index + width);
  }

  const ratio = removed / Math.max(1, opaque);
  if (ratio < 0.03 || ratio > 0.92) {
    return {
      bitmap: new Uint8ClampedArray(bitmap),
      removed: false,
      alreadyTransparent: hasTransparentCorners,
    };
  }
  return { bitmap: output, removed: true, alreadyTransparent: hasTransparentCorners };
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

function drawCornerVignette(image: Image, placement: LogoPlacement): void {
  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;
  const radiusX = placement.width * 1.45;
  const radiusY = placement.height * 2.1;
  const x0 = Math.max(0, Math.floor(centerX - radiusX));
  const y0 = Math.max(0, Math.floor(centerY - radiusY));
  const x1 = Math.min(image.width, Math.ceil(centerX + radiusX));
  const y1 = Math.min(image.height, Math.ceil(centerY + radiusY));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const distance = Math.sqrt(
        ((x - centerX) / radiusX) ** 2
          + ((y - centerY) / radiusY) ** 2,
      );
      if (distance >= 1) continue;
      const strength = (1 - distance) ** 2 * 0.5;
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        image.bitmap[offset + channel] = Math.round(
          image.bitmap[offset + channel] * (1 - strength),
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
    corner: "top-left",
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

  const decision = selectLogoPlacement(
    base.bitmap,
    base.width,
    base.height,
    logo.width,
    logo.height,
    options.format ?? "original",
  );
  const placement = decision.placement;
  logo.resize(placement.width, placement.height);
  if (decision.useVignette) drawCornerVignette(base, placement);
  drawSubtleShadow(base, logo, placement.x, placement.y);
  base.composite(logo, placement.x, placement.y);

  return {
    bytes: new Uint8Array(await base.encode(6)),
    width: base.width,
    height: base.height,
    placement,
    backgroundRemoved: cleaned.removed,
    panelUsed: false,
    vignetteUsed: decision.useVignette,
  };
}

export function buildBrandGenerationGuidance(
  colors: string[],
  options: { hasLogo: boolean; hasBasePhoto: boolean },
): string {
  const palette = colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 4);
  const lines = [
    options.hasLogo
      ? "Reserve em um dos cantos uma área ESCURA e LISA para a marca, como parede escura, sombra, céu noturno ou superfície fosca, com cerca de 25% da largura por 15% da altura. Deixe esse canto sem luzes, janelas, objetos importantes, texto ou logos. A logo original será aplicada depois da geração."
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
