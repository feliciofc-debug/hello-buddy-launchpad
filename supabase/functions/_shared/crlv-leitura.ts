import { extractDocumentText } from "./document-extract.ts";
import { type CrlvParserResultado, parseCrlvText } from "./crlv-parser.ts";

const MAX_BYTES = 15 * 1024 * 1024;
const MIN_PDF_TEXT_CHARS = 80;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function ocrLocal(
  bytes: Uint8Array,
  mime: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const url = Deno.env.get("AMZ_OCR_URL")?.trim();
  const token = Deno.env.get("AMZ_OCR_TOKEN")?.trim();
  if (!url || !token) throw new Error("OCR local não configurado");
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "X-OCR-Token": token,
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`OCR local indisponível (${response.status})`);
  }
  const payload = await response.json().catch(() => ({})) as { text?: unknown };
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

export type CrlvLeituraResultado = {
  texto: string;
  parser: CrlvParserResultado;
  metodo: "pdf_texto" | "ocr_local";
};

export async function lerCrlvLocal(
  bytes: Uint8Array,
  mime: string,
  filename?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CrlvLeituraResultado> {
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    throw new Error("Documento deve ter até 15 MB");
  }
  const normalizedMime = String(mime || "").toLowerCase();
  if (
    normalizedMime === "application/pdf" ||
    filename?.toLowerCase().endsWith(".pdf")
  ) {
    const extracted = await extractDocumentText(
      bytesToBase64(bytes),
      normalizedMime || "application/pdf",
      filename,
    );
    if (
      extracted.supported && extracted.text.trim().length >= MIN_PDF_TEXT_CHARS
    ) {
      return {
        texto: extracted.text,
        parser: parseCrlvText(extracted.text, "pdf_texto"),
        metodo: "pdf_texto",
      };
    }
  }
  const text = await ocrLocal(bytes, normalizedMime, fetchImpl);
  if (!text) throw new Error("OCR local não conseguiu ler o documento");
  return {
    texto: text,
    parser: parseCrlvText(text, "ocr"),
    metodo: "ocr_local",
  };
}
