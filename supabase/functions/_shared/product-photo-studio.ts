export type ProductPhotoStyle = "impacto" | "catalogo" | "destaque";

export type ProductPhotoPixels = {
  width: number;
  height: number;
  bitmap: Uint8Array | Uint8ClampedArray;
};

export type ProductCutoutResult = {
  bitmap: Uint8Array;
  segmented: boolean;
  removedRatio: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
};

type RGB = [number, number, number];

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

function borderIndexes(width: number, height: number): number[] {
  const indexes: number[] = [];
  for (let x = 0; x < width; x++) {
    indexes.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    indexes.push(y * width, y * width + width - 1);
  }
  return indexes;
}

function dominantBorderColor(image: ProductPhotoPixels): {
  color: RGB;
  ratio: number;
} {
  const buckets = new Map<string, { count: number; sum: RGB }>();
  const indexes = borderIndexes(image.width, image.height);
  for (const index of indexes) {
    const offset = index * 4;
    const key = `${image.bitmap[offset] >> 4},${
      image.bitmap[offset + 1] >> 4
    },${image.bitmap[offset + 2] >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    bucket.sum[0] += image.bitmap[offset];
    bucket.sum[1] += image.bitmap[offset + 1];
    bucket.sum[2] += image.bitmap[offset + 2];
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return {
    color: dominant
      ? dominant.sum.map((value) => Math.round(value / dominant.count)) as RGB
      : [255, 255, 255],
    ratio: indexes.length && dominant ? dominant.count / indexes.length : 0,
  };
}

function contentBounds(
  bitmap: Uint8Array,
  width: number,
  height: number,
): ProductCutoutResult["bounds"] {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bitmap[(y * width + x) * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function cutOutProductBackground(
  image: ProductPhotoPixels,
): ProductCutoutResult {
  const original = new Uint8Array(image.bitmap);
  const transparent =
    borderIndexes(image.width, image.height).filter((index) =>
      original[index * 4 + 3] < 32
    ).length;
  if (transparent > 0) {
    return {
      bitmap: original,
      segmented: true,
      removedRatio: transparent /
        borderIndexes(image.width, image.height).length,
      bounds: contentBounds(original, image.width, image.height),
    };
  }
  const background = dominantBorderColor(image);
  if (background.ratio < 0.45) {
    return {
      bitmap: original,
      segmented: false,
      removedRatio: 0,
      bounds: contentBounds(original, image.width, image.height),
    };
  }

  const result = new Uint8Array(original);
  const visited = new Uint8Array(image.width * image.height);
  const queue: number[] = [];
  const enqueue = (index: number) => {
    if (index < 0 || index >= visited.length || visited[index]) return;
    const offset = index * 4;
    const pixel: RGB = [
      original[offset],
      original[offset + 1],
      original[offset + 2],
    ];
    if (colorDistance(pixel, background.color) > 62) return;
    visited[index] = 1;
    queue.push(index);
  };
  for (const index of borderIndexes(image.width, image.height)) enqueue(index);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    const offset = index * 4;
    const pixel: RGB = [
      original[offset],
      original[offset + 1],
      original[offset + 2],
    ];
    const distance = colorDistance(pixel, background.color);
    result[offset + 3] = distance <= 34
      ? 0
      : Math.min(result[offset + 3], Math.round((distance - 34) / 28 * 255));
    if (x > 0) enqueue(index - 1);
    if (x + 1 < image.width) enqueue(index + 1);
    if (y > 0) enqueue(index - image.width);
    if (y + 1 < image.height) enqueue(index + image.width);
  }

  const removedRatio = queue.length / visited.length;
  const bounds = contentBounds(result, image.width, image.height);
  if (!bounds || removedRatio < 0.08 || removedRatio > 0.88) {
    return {
      bitmap: original,
      segmented: false,
      removedRatio,
      bounds: contentBounds(original, image.width, image.height),
    };
  }
  return { bitmap: result, segmented: true, removedRatio, bounds };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function correctProductColors(
  bitmap: Uint8Array,
  width?: number,
  height?: number,
): Uint8Array {
  const result = new Uint8Array(bitmap);
  const sums = [0, 0, 0];
  let count = 0;
  for (let offset = 0; offset < result.length; offset += 4) {
    if (result[offset + 3] < 32) continue;
    sums[0] += result[offset];
    sums[1] += result[offset + 1];
    sums[2] += result[offset + 2];
    count++;
  }
  if (!count) return result;
  const average = sums.map((sum) => sum / count);
  const gray = (average[0] + average[1] + average[2]) / 3;
  const gains = average.map((channel) =>
    Math.max(0.88, Math.min(1.12, gray / Math.max(channel, 1)))
  );
  for (let offset = 0; offset < result.length; offset += 4) {
    if (result[offset + 3] < 32) continue;
    const channels = [0, 1, 2].map((channel) =>
      clamp((result[offset + channel] - 128) * 1.04 * gains[channel] + 128)
    );
    const luminance = channels[0] * 0.299 + channels[1] * 0.587 +
      channels[2] * 0.114;
    for (let channel = 0; channel < 3; channel++) {
      result[offset + channel] = clamp(
        luminance + (channels[channel] - luminance) * 1.05,
      );
    }
  }
  if (
    width && height && width * height * 4 === result.length &&
    width > 2 && height > 2
  ) {
    const leveled = new Uint8Array(result);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const offset = (y * width + x) * 4;
        if (leveled[offset + 3] < 32) continue;
        for (let channel = 0; channel < 3; channel++) {
          const neighbors = (
            leveled[offset - 4 + channel] +
            leveled[offset + 4 + channel] +
            leveled[offset - width * 4 + channel] +
            leveled[offset + width * 4 + channel]
          ) / 4;
          result[offset + channel] = clamp(
            leveled[offset + channel] * 1.12 - neighbors * 0.12,
          );
        }
      }
    }
  }
  return result;
}

function parseHex(value: string): RGB {
  const match = String(value || "").match(/^#?([0-9a-f]{6})$/i);
  if (!match) return [96, 165, 250];
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function mix(first: RGB, second: RGB, amount: number): RGB {
  return first.map((value, index) =>
    clamp(value * (1 - amount) + second[index] * amount)
  ) as RGB;
}

export function productStudioPalette(
  style: ProductPhotoStyle,
  accentColor: string,
): { top: RGB; bottom: RGB; shadow: RGB } {
  const accent = parseHex(accentColor);
  if (style === "catalogo") {
    return {
      top: mix([255, 253, 248], accent, 0.12),
      bottom: mix([247, 244, 237], accent, 0.2),
      shadow: mix([90, 90, 90], accent, 0.12),
    };
  }
  return {
    top: mix([15, 18, 24], accent, 0.12),
    bottom: mix([3, 6, 12], accent, 0.22),
    shadow: [0, 0, 0],
  };
}

export function paintProductStudioBackground(
  image: ProductPhotoPixels,
  style: ProductPhotoStyle,
  accentColor: string,
): void {
  const palette = productStudioPalette(style, accentColor);
  for (let y = 0; y < image.height; y++) {
    const progress = image.height <= 1 ? 0 : y / (image.height - 1);
    const color = mix(palette.top, palette.bottom, progress);
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4;
      image.bitmap[offset] = color[0];
      image.bitmap[offset + 1] = color[1];
      image.bitmap[offset + 2] = color[2];
      image.bitmap[offset + 3] = 255;
    }
  }
}
