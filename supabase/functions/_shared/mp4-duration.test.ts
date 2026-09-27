import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseMp4DurationSeconds } from "./mp4-duration.ts";

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function box(type: string, payload: ArrayLike<number> = new Uint8Array()): Uint8Array {
  const result = new Uint8Array(8 + payload.length);
  new DataView(result.buffer).setUint32(0, result.length, false);
  result.set(new TextEncoder().encode(type), 4);
  result.set(payload, 8);
  return result;
}

function minimalMoov(duration: number, timescale: number): Uint8Array {
  const payload = new Uint8Array(20);
  const view = new DataView(payload.buffer);
  payload[0] = 0;
  view.setUint32(12, timescale, false);
  view.setUint32(16, duration, false);
  return box("moov", box("mvhd", payload));
}

Deno.test("lê duração de MP4 com moov no início", () => {
  const mp4 = concat(minimalMoov(12_500, 1_000), box("mdat", new Uint8Array(16)));
  assertEquals(parseMp4DurationSeconds(mp4), 12.5);
});

Deno.test("lê duração de MP4 com moov no fim", () => {
  const mp4 = concat(
    box("ftyp", new TextEncoder().encode("isom")),
    box("mdat", new Uint8Array(16)),
    minimalMoov(9_000, 1_000),
  );
  assertEquals(parseMp4DurationSeconds(mp4), 9);
});

Deno.test("arquivo inválido não produz duração", () => {
  assertEquals(parseMp4DurationSeconds(new TextEncoder().encode("não é mp4")), null);
});
