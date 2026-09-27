const DEFAULT_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function uint32(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function uint64(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = Number(view.getBigUint64(offset, false));
  return Number.isSafeInteger(value) ? value : null;
}

function boxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
}

type Mp4Box = { type: string; start: number; dataStart: number; end: number };

function readBox(bytes: Uint8Array, offset: number, boundary: number): Mp4Box | null {
  if (offset + 8 > boundary) return null;
  const size32 = uint32(bytes, offset);
  if (size32 == null) return null;
  let headerSize = 8;
  let size = size32;
  if (size32 === 1) {
    const size64 = uint64(bytes, offset + 8);
    if (size64 == null) return null;
    size = size64;
    headerSize = 16;
  } else if (size32 === 0) {
    size = boundary - offset;
  }
  if (size < headerSize || offset + size > boundary) return null;
  return {
    type: boxType(bytes, offset),
    start: offset,
    dataStart: offset + headerSize,
    end: offset + size,
  };
}

function findBox(bytes: Uint8Array, type: string, start: number, end: number): Mp4Box | null {
  let offset = start;
  while (offset + 8 <= end) {
    const box = readBox(bytes, offset, end);
    if (!box) return null;
    if (box.type === type) return box;
    offset = box.end;
  }
  return null;
}

export function parseMp4DurationSeconds(bytes: Uint8Array): number | null {
  const moov = findBox(bytes, "moov", 0, bytes.length);
  if (!moov) return null;
  const mvhd = findBox(bytes, "mvhd", moov.dataStart, moov.end);
  if (!mvhd || mvhd.dataStart + 20 > mvhd.end) return null;

  const version = bytes[mvhd.dataStart];
  const timescaleOffset = mvhd.dataStart + (version === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;
  const timescale = uint32(bytes, timescaleOffset);
  const duration = version === 1
    ? uint64(bytes, durationOffset)
    : uint32(bytes, durationOffset);
  if (!timescale || duration == null || duration <= 0) return null;
  const seconds = duration / timescale;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export async function fetchMp4DurationSeconds(
  url: string,
  options: { fetcher?: typeof fetch; maxBytes?: number } = {},
): Promise<number | null> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_VIDEO_BYTES;
  const response = await (options.fetcher ?? fetch)(url);
  if (!response.ok) return null;
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) return null;

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length <= maxBytes ? parseMp4DurationSeconds(bytes) : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseMp4DurationSeconds(bytes);
}
