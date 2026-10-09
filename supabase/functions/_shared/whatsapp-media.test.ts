import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeImageDocuments } from "./whatsapp-media.ts";

function base64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

Deno.test("documento JPEG confirmado por magic bytes vira imagem", () => {
  const [item] = normalizeImageDocuments([{
    kind: "document",
    mime: "application/octet-stream",
    filename: "carro.jpg",
    base64: base64([0xff, 0xd8, 0xff, 0xdb, 0, 1]),
  }]);
  assertEquals(item.kind, "image");
  assertEquals(item.mime, "image/jpeg");
});

Deno.test("documento com mime de imagem também exige magic bytes", () => {
  const [item] = normalizeImageDocuments([{
    kind: "document",
    mime: "image/png",
    filename: "arquivo.png",
    base64: base64([0x25, 0x50, 0x44, 0x46]),
  }]);
  assertEquals(item.kind, "document");
});

Deno.test("PDF continua no fluxo de documento", () => {
  const [item] = normalizeImageDocuments([{
    kind: "document",
    mime: "application/pdf",
    filename: "contrato.pdf",
    base64: base64([0x25, 0x50, 0x44, 0x46]),
  }]);
  assertEquals(item.kind, "document");
});

Deno.test("documento HEIC confirmado vira imagem", () => {
  const [item] = normalizeImageDocuments([{
    kind: "document",
    mime: "image/heic",
    filename: "carro.heic",
    base64: base64([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70,
      0x68, 0x65, 0x69, 0x63,
    ]),
  }]);
  assertEquals(item.kind, "image");
  assertEquals(item.mime, "image/heic");
});
