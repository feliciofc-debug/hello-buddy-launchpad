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
