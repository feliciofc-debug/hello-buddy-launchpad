import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { webp_to_png } from "jsr:@liuxspro/webp-to-png@0.0.3";
import { detectImageFormat } from "./image-file-format.ts";

export const LOGO_BACKGROUND_WARNING =
  "Sua logo tem fundo. Para ficar perfeita em qualquer cor, envie uma versão PNG transparente.";

export type LogoBackgroundResult = {
  bytes: Uint8Array;
  mime: string;
  changed: boolean;
  warning: string | null;
  width?: number;
  height?: number;
};

export type DarkLogoResult = {
  bytes: Uint8Array;
  mime: "image/png";
  generated: boolean;
  darkPixelRatio: number;
  width?: number;
  height?: number;
};

type RGB = [number, number, number];

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

async function decodeLogo(bytes: Uint8Array): Promise<Image | null> {
  const format = detectImageFormat(bytes);
  if (!format || format.mime === "image/svg+xml") return null;
  const decoded = format.mime === "image/webp" ? await webp_to_png(bytes) : bytes;
  return await Image.decode(decoded);
}

function borderOffsets(width: number, height: number): number[] {
  const offsets: number[] = [];
  for (let x = 0; x < width; x++) {
    offsets.push(x * 4, ((height - 1) * width + x) * 4);
  }
  for (let y = 1; y < height - 1; y++) {
    offsets.push((y * width) * 4, (y * width + width - 1) * 4);
  }
  return offsets;
}

function dominantBorderColor(
  bitmap: Uint8Array | Uint8ClampedArray,
  offsets: number[],
): { color: RGB; uniformRatio: number; transparentRatio: number } {
  const buckets = new Map<string, { count: number; sum: RGB }>();
  let transparent = 0;
  for (const offset of offsets) {
    if (bitmap[offset + 3] < 245) transparent++;
    const key = `${bitmap[offset] >> 4},${bitmap[offset + 1] >> 4},${
      bitmap[offset + 2] >> 4
    }`;
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    bucket.sum[0] += bitmap[offset];
    bucket.sum[1] += bitmap[offset + 1];
    bucket.sum[2] += bitmap[offset + 2];
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const color: RGB = dominant
    ? dominant.sum.map((value) => Math.round(value / dominant.count)) as RGB
    : [255, 255, 255];
  const uniform = offsets.filter((offset) =>
    colorDistance(color, [
      bitmap[offset],
      bitmap[offset + 1],
      bitmap[offset + 2],
    ]) <= 24
  ).length;
  return {
    color,
    uniformRatio: offsets.length ? uniform / offsets.length : 0,
    transparentRatio: offsets.length ? transparent / offsets.length : 0,
  };
}

function removeConnectedBackground(image: Image, background: RGB): void {
  const { width, height, bitmap } = image;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * 4;
    const distance = colorDistance(background, [
      bitmap[offset],
      bitmap[offset + 1],
      bitmap[offset + 2],
    ]);
    if (distance > 48) return;
    visited[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const distance = colorDistance(background, [
      bitmap[offset],
      bitmap[offset + 1],
      bitmap[offset + 2],
    ]);
    bitmap[offset + 3] = distance <= 24
      ? 0
      : Math.min(bitmap[offset + 3], Math.round((distance - 24) / 24 * 255));
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
}

function trimTransparent(image: Image): Image {
  const { width, height, bitmap } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] <= 4) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return image;
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const paddingX = Math.max(1, Math.ceil(contentWidth * 0.02));
  const paddingY = Math.max(1, Math.ceil(contentHeight * 0.02));
  const x = Math.max(0, minX - paddingX);
  const y = Math.max(0, minY - paddingY);
  const right = Math.min(width - 1, maxX + paddingX);
  const bottom = Math.min(height - 1, maxY + paddingY);
  if (x === 0 && y === 0 && right === width - 1 && bottom === height - 1) {
    return image;
  }
  return image.crop(x, y, right - x + 1, bottom - y + 1);
}

export async function removeSolidLogoBackground(
  bytes: Uint8Array,
  mime: string,
): Promise<LogoBackgroundResult> {
  try {
    const image = await decodeLogo(bytes);
    if (!image) {
      return { bytes, mime, changed: false, warning: null };
    }
    const border = dominantBorderColor(
      image.bitmap,
      borderOffsets(image.width, image.height),
    );
    if (border.transparentRatio > 0) {
      return {
        bytes,
        mime,
        changed: false,
        warning: null,
        width: image.width,
        height: image.height,
      };
    }
    if (border.uniformRatio < 0.9) {
      return {
        bytes,
        mime,
        changed: false,
        warning: LOGO_BACKGROUND_WARNING,
        width: image.width,
        height: image.height,
      };
    }
    removeConnectedBackground(image, border.color);
    const trimmed = trimTransparent(image);
    return {
      bytes: new Uint8Array(await trimmed.encode()),
      mime: "image/png",
      changed: true,
      warning: null,
      width: trimmed.width,
      height: trimmed.height,
    };
  } catch (error) {
    console.warn("[logo-background] mantendo original:", (error as Error).message);
    return { bytes, mime, changed: false, warning: LOGO_BACKGROUND_WARNING };
  }
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const values = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function saturation(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max === 0 ? 0 : (max - min) / max;
}

export async function deriveDarkBackgroundLogo(
  bytes: Uint8Array,
): Promise<DarkLogoResult> {
  const image = await decodeLogo(bytes);
  if (!image) {
    return {
      bytes,
      mime: "image/png",
      generated: false,
      darkPixelRatio: 0,
    };
  }
  let opaque = 0;
  let dark = 0;
  for (let offset = 0; offset < image.bitmap.length; offset += 4) {
    if (image.bitmap[offset + 3] <= 20) continue;
    opaque++;
    if (
      relativeLuminance(
          image.bitmap[offset],
          image.bitmap[offset + 1],
          image.bitmap[offset + 2],
        ) < 0.25 &&
      saturation(
          image.bitmap[offset],
          image.bitmap[offset + 1],
          image.bitmap[offset + 2],
        ) < 0.25
    ) dark++;
  }
  const darkPixelRatio = opaque ? dark / opaque : 0;
  if (darkPixelRatio < 0.15) {
    return {
      bytes,
      mime: "image/png",
      generated: false,
      darkPixelRatio,
      width: image.width,
      height: image.height,
    };
  }
  for (let offset = 0; offset < image.bitmap.length; offset += 4) {
    if (
      image.bitmap[offset + 3] > 20 &&
      relativeLuminance(
          image.bitmap[offset],
          image.bitmap[offset + 1],
          image.bitmap[offset + 2],
        ) < 0.25 &&
      saturation(
          image.bitmap[offset],
          image.bitmap[offset + 1],
          image.bitmap[offset + 2],
        ) < 0.25
    ) {
      image.bitmap[offset] = 255;
      image.bitmap[offset + 1] = 255;
      image.bitmap[offset + 2] = 255;
    }
  }
  return {
    bytes: new Uint8Array(await image.encode()),
    mime: "image/png",
    generated: true,
    darkPixelRatio,
    width: image.width,
    height: image.height,
  };
}
