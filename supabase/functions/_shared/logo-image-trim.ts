import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

export type LogoContentBounds = { x: number; y: number; width: number; height: number };

const WHITE_TOLERANCE = 12;
const PADDING_RATIO = 0.04;

function isBorderPixel(r: number, g: number, b: number, a: number): boolean {
  return a <= WHITE_TOLERANCE
    || (
      Math.abs(255 - r) <= WHITE_TOLERANCE
      && Math.abs(255 - g) <= WHITE_TOLERANCE
      && Math.abs(255 - b) <= WHITE_TOLERANCE
    );
}

export function findLogoContentBounds(
  bitmap: Uint8ClampedArray,
  width: number,
  height: number,
): LogoContentBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (isBorderPixel(bitmap[offset], bitmap[offset + 1], bitmap[offset + 2], bitmap[offset + 3])) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const paddingX = Math.max(1, Math.ceil(contentWidth * PADDING_RATIO));
  const paddingY = Math.max(1, Math.ceil(contentHeight * PADDING_RATIO));
  const x = Math.max(0, minX - paddingX);
  const y = Math.max(0, minY - paddingY);
  const right = Math.min(width - 1, maxX + paddingX);
  const bottom = Math.min(height - 1, maxY + paddingY);
  return { x, y, width: right - x + 1, height: bottom - y + 1 };
}

export async function trimLogoImage(
  bytes: Uint8Array,
  mime: string,
): Promise<{ bytes: Uint8Array; mime: string; trimmed: boolean }> {
  const rawMime = mime.split(";")[0].trim().toLowerCase();
  const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
  if (normalizedMime !== "image/png" && normalizedMime !== "image/jpeg") {
    return { bytes, mime: normalizedMime, trimmed: false };
  }
  try {
    const image = await Image.decode(bytes);
    const bounds = findLogoContentBounds(image.bitmap, image.width, image.height);
    if (!bounds) return { bytes, mime: normalizedMime, trimmed: false };
    const reduction = 1 - (bounds.width * bounds.height) / (image.width * image.height);
    if (reduction < 0.03) return { bytes, mime: normalizedMime, trimmed: false };
    const cropped = image.crop(bounds.x, bounds.y, bounds.width, bounds.height);
    const encoded = await cropped.encode(6);
    return { bytes: new Uint8Array(encoded), mime: "image/png", trimmed: true };
  } catch (error) {
    console.warn("[logo-trim] mantendo original:", (error as Error).message);
    return { bytes, mime: normalizedMime, trimmed: false };
  }
}
