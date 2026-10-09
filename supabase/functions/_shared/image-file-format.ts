export type DetectedImageFormat = {
  mime:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif"
    | "image/heic"
    | "image/svg+xml";
  extension: "jpg" | "png" | "webp" | "gif" | "heic" | "svg";
};

const ASCII_DECODER = new TextDecoder();

export function detectImageFormat(
  bytes: Uint8Array,
): DetectedImageFormat | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return { mime: "image/jpeg", extension: "jpg" };
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return { mime: "image/png", extension: "png" };
  if (
    bytes.length >= 12 &&
    ASCII_DECODER.decode(bytes.subarray(0, 4)) === "RIFF" &&
    ASCII_DECODER.decode(bytes.subarray(8, 12)) === "WEBP"
  ) return { mime: "image/webp", extension: "webp" };
  if (
    bytes.length >= 12 &&
    ASCII_DECODER.decode(bytes.subarray(4, 8)) === "ftyp" &&
    /^(?:hei[cfmxs]|hev[cf]|mif1|msf1)$/i.test(
      ASCII_DECODER.decode(bytes.subarray(8, 12)),
    )
  ) return { mime: "image/heic", extension: "heic" };
  if (
    bytes.length >= 6 &&
    /^GIF8[79]a$/.test(ASCII_DECODER.decode(bytes.subarray(0, 6)))
  ) return { mime: "image/gif", extension: "gif" };
  const prefix = ASCII_DECODER.decode(
    bytes.subarray(0, Math.min(bytes.length, 512)),
  )
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (/^(?:<\?xml[\s\S]*?>\s*)?<svg\b/i.test(prefix)) {
    return { mime: "image/svg+xml", extension: "svg" };
  }
  return null;
}

export function imageUploadMetadata(
  bytes: Uint8Array,
  _declaredMime?: string | null,
): DetectedImageFormat | null {
  return detectImageFormat(bytes);
}
