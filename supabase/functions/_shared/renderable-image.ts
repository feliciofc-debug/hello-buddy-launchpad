import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { webp_to_png } from "jsr:@liuxspro/webp-to-png@0.0.3";
import { detectImageFormat } from "./image-file-format.ts";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function renderableImageDataUrl(
  bytes: Uint8Array,
  label: "foto" | "logo",
  log: (message: string) => void = console.warn,
): Promise<string | null> {
  const format = detectImageFormat(bytes);
  if (!format) {
    log(`${label} inválida: magic bytes desconhecidos`);
    return null;
  }
  if (format.mime === "image/svg+xml") {
    return label === "logo"
      ? `data:${format.mime};base64,${toBase64(bytes)}`
      : null;
  }
  try {
    if (format.mime === "image/webp") {
      const png = await webp_to_png(bytes);
      await Image.decode(png);
      return `data:image/png;base64,${toBase64(png)}`;
    }
    const decoded = await Image.decode(bytes);
    if (format.mime === "image/gif") {
      const png = new Uint8Array(await decoded.encode());
      return `data:image/png;base64,${toBase64(png)}`;
    }
    return `data:${format.mime};base64,${toBase64(bytes)}`;
  } catch (error) {
    log(`${label} inválida: ${(error as Error).message}`);
    return null;
  }
}

export async function normalizeImageDataUrl(
  value: string,
  label: "foto" | "logo",
  log: (message: string) => void = console.warn,
): Promise<string | null> {
  const match = value.match(/^data:image\/[\w.+-]+;base64,(.+)$/i);
  if (!match) return null;
  try {
    return await renderableImageDataUrl(
      Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0)),
      label,
      log,
    );
  } catch {
    log(`${label} inválida: base64 malformado`);
    return null;
  }
}
