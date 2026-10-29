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
): Promise<{ texto: string; metricas: CrlvOcrMetricas | null }> {
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
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`OCR local indisponível (${response.status})`);
  }
  const payload = await response.json().catch(() => ({})) as {
    text?: unknown;
    metrics?: unknown;
  };
  return {
    texto: typeof payload.text === "string" ? payload.text.trim() : "",
    metricas: sanitizeOcrMetrics(payload.metrics),
  };
}

export async function extrairTextoOcrLocal(
  bytes: Uint8Array,
  mime: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    throw new Error("Documento deve ter até 15 MB");
  }
  const result = await ocrLocal(
    bytes,
    String(mime || "application/octet-stream").toLowerCase(),
    fetchImpl,
  );
  return result.texto;
}

export type CrlvOcrMetricas = {
  motor: "paddleocr" | "tesseract";
  variante_vencedora: string;
  tempo_ms: number;
  n_campos_validos: number;
  reason?: "paddle_full_indisponivel";
};

const OCR_VARIANTS = new Set([
  "pagina_cor",
  "pagina_clahe",
  "pagina_sem_fundo",
  "pagina_adaptativa",
  "perspectiva_cor",
  "perspectiva_clahe",
  "perspectiva_sem_fundo",
  "perspectiva_adaptativa",
]);

function sanitizeOcrMetrics(value: unknown): CrlvOcrMetricas | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const motor = raw.motor === "paddleocr" || raw.motor === "tesseract"
    ? raw.motor
    : null;
  const variante = String(raw.variante_vencedora ?? "");
  const tempo = Math.max(0, Math.min(40_000, Math.round(Number(raw.tempo_ms))));
  const fields = Math.max(
    0,
    Math.min(3, Math.round(Number(raw.n_campos_validos))),
  );
  if (
    !motor || !OCR_VARIANTS.has(variante) || !Number.isFinite(tempo) ||
    !Number.isFinite(fields)
  ) return null;
  return {
    motor,
    variante_vencedora: variante,
    tempo_ms: tempo,
    n_campos_validos: fields,
    ...(raw.reason === "paddle_full_indisponivel"
      ? { reason: raw.reason }
      : {}),
  };
}

export type DocumentoDetectado = {
  documento: boolean;
  possivel_documento: boolean;
  tipo: "crlv" | "cnh" | "rg" | "outro" | null;
  vehicle_detected?: boolean;
  vehicle_area_ratio?: number;
};

export async function detectarDocumentoLocal(
  bytes: Uint8Array,
  mime: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DocumentoDetectado> {
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    throw new Error("Documento deve ter até 15 MB");
  }
  const baseUrl = Deno.env.get("AMZ_OCR_URL")?.trim();
  const token = Deno.env.get("AMZ_OCR_TOKEN")?.trim();
  if (!baseUrl || !token) throw new Error("Detector local não configurado");
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/ocr\/?$/, "")}/detectar`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "X-OCR-Token": token,
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Detector local indisponível (${response.status})`);
  }
  const payload = await response.json().catch(() => ({})) as {
    documento?: unknown;
    possivel_documento?: unknown;
    tipo?: unknown;
    vehicle_detected?: unknown;
    vehicle_area_ratio?: unknown;
  };
  const tipo = ["crlv", "cnh", "rg", "outro"].includes(String(payload.tipo))
    ? payload.tipo as DocumentoDetectado["tipo"]
    : null;
  const vehicleArea = Number(payload.vehicle_area_ratio);
  const vehicleDetected = payload.vehicle_detected === true &&
    Number.isFinite(vehicleArea);
  const vehicleMeta = vehicleDetected
    ? {
      vehicle_detected: true,
      vehicle_area_ratio: vehicleArea,
    }
    : {};
  if (payload.documento === true) {
    return {
      documento: true,
      possivel_documento: false,
      tipo,
      ...vehicleMeta,
    };
  }
  if (vehicleDetected && vehicleArea >= 0.15) {
    return {
      documento: false,
      possivel_documento: false,
      tipo: null,
      ...vehicleMeta,
    };
  }
  return {
    documento: false,
    possivel_documento: payload.possivel_documento === true,
    tipo,
    ...vehicleMeta,
  };
}

export type CrlvLeituraResultado = {
  texto: string;
  parser: CrlvParserResultado;
  metodo: "pdf_texto" | "ocr_local";
  metricas_ocr: CrlvOcrMetricas | null;
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
        metricas_ocr: null,
      };
    }
  }
  const ocr = await ocrLocal(bytes, normalizedMime, fetchImpl);
  return {
    texto: ocr.texto,
    parser: parseCrlvText(ocr.texto, "ocr"),
    metodo: "ocr_local",
    metricas_ocr: ocr.metricas,
  };
}
