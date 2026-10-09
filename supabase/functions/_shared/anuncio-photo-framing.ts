export type FotoBox = {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

export type PixelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhotoFramePlan = {
  mode: "box" | "contain";
  resizedWidth: number;
  resizedHeight: number;
  x: number;
  y: number;
  transformedBox: PixelBox | null;
};

const OBJECT_PADDING_RATIO = 0.06;
const EPSILON = 0.75;

export function normalizeFotoBox(value: unknown): FotoBox | null {
  const candidate = Array.isArray(value)
    ? value
    : value && typeof value === "object"
    ? [
      (value as Record<string, unknown>).ymin,
      (value as Record<string, unknown>).xmin,
      (value as Record<string, unknown>).ymax,
      (value as Record<string, unknown>).xmax,
    ]
    : null;
  if (
    !candidate ||
    candidate.length !== 4 ||
    candidate.some((part) => !Number.isFinite(Number(part)))
  ) return null;
  const [ymin, xmin, ymax, xmax] = candidate.map(Number);
  if (
    [ymin, xmin, ymax, xmax].some((part) => part < 0 || part > 1000) ||
    ymin >= ymax ||
    xmin >= xmax
  ) return null;
  return { ymin, xmin, ymax, xmax };
}

export function parseFotoBoxFromVisionResponse(text: string): FotoBox | null {
  const clean = String(text || "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(clean);
    return normalizeFotoBox(parsed?.box_2d ?? parsed?.foto_box ?? parsed);
  } catch {
    const match = clean.match(
      /(?:box_2d|foto_box)?[^[]*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i,
    );
    return match ? normalizeFotoBox(match.slice(1).map(Number)) : null;
  }
}

export function frameContainsObject(
  plan: PhotoFramePlan,
  targetWidth: number,
  targetHeight: number,
): boolean {
  const box = plan.transformedBox;
  if (!box) return plan.mode === "contain";
  return box.x >= -EPSILON &&
    box.y >= -EPSILON &&
    box.x + box.width <= targetWidth + EPSILON &&
    box.y + box.height <= targetHeight + EPSILON;
}

function containPlan(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): PhotoFramePlan {
  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
  const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
  return {
    mode: "contain",
    resizedWidth,
    resizedHeight,
    x: Math.round((targetWidth - resizedWidth) / 2),
    y: Math.round((targetHeight - resizedHeight) / 2),
    transformedBox: null,
  };
}

export function calculatePhotoFrame(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  fotoBox?: unknown;
}): PhotoFramePlan {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = input;
  const fallback = containPlan(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  );
  const box = normalizeFotoBox(input.fotoBox);
  if (!box) return fallback;

  const xmin = box.xmin / 1000 * sourceWidth;
  const xmax = box.xmax / 1000 * sourceWidth;
  const ymin = box.ymin / 1000 * sourceHeight;
  const ymax = box.ymax / 1000 * sourceHeight;
  const objectWidth = xmax - xmin;
  const objectHeight = ymax - ymin;
  const paddedWidth = objectWidth * (1 + OBJECT_PADDING_RATIO * 2);
  const paddedHeight = objectHeight * (1 + OBJECT_PADDING_RATIO * 2);
  const scale = Math.min(
    targetWidth / paddedWidth,
    targetHeight / paddedHeight,
  );
  if (!Number.isFinite(scale) || scale <= 0) return fallback;

  const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
  const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
  const scaleX = resizedWidth / sourceWidth;
  const scaleY = resizedHeight / sourceHeight;
  const x = Math.round(targetWidth / 2 - ((xmin + xmax) / 2) * scaleX);
  // A folga inferior já inclui 6% da altura do objeto para preservar a sombra.
  const y = Math.round(
    targetHeight - (ymax + objectHeight * OBJECT_PADDING_RATIO) * scaleY,
  );
  const plan: PhotoFramePlan = {
    mode: "box",
    resizedWidth,
    resizedHeight,
    x,
    y,
    transformedBox: {
      x: x + xmin * scaleX,
      y: y + ymin * scaleY,
      width: objectWidth * scaleX,
      height: objectHeight * scaleY,
    },
  };
  return frameContainsObject(plan, targetWidth, targetHeight) ? plan : fallback;
}
