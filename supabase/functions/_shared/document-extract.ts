// ============================================================================
// Extrai texto legível de documentos recebidos no WhatsApp.
// Somente leitura — devolve { text, truncated, supported, note }.
// ============================================================================

import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

export const DOC_MAX_CHARS = 60_000;

export type DocExtractResult = {
  supported: boolean;
  text: string;
  truncated: boolean;
  note?: string;
  kind: string; // 'text' | 'markdown' | 'json' | 'pdf' | 'unsupported'
};

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= DOC_MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, DOC_MAX_CHARS), truncated: true };
}

function isTextualMime(mime: string, filename?: string): string | null {
  const m = (mime || "").toLowerCase();
  const f = (filename || "").toLowerCase();
  if (m.includes("markdown") || f.endsWith(".md") || f.endsWith(".markdown")) return "markdown";
  if (m === "application/json" || f.endsWith(".json")) return "json";
  if (m.startsWith("text/") || f.endsWith(".txt") || f.endsWith(".log") || f.endsWith(".csv")
      || f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".jsx")
      || f.endsWith(".py") || f.endsWith(".html") || f.endsWith(".css") || f.endsWith(".yml")
      || f.endsWith(".yaml") || f.endsWith(".xml") || f.endsWith(".sql")) return "text";
  return null;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : Array.isArray(text) ? text.join("\n\n") : "";
}

export async function extractDocumentText(
  base64: string,
  mime: string,
  filename?: string,
): Promise<DocExtractResult> {
  const bytes = base64Decode(base64);
  const textualKind = isTextualMime(mime, filename);

  if (textualKind) {
    try {
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const { text, truncated } = truncate(raw);
      return { supported: true, text, truncated, kind: textualKind };
    } catch (e) {
      return { supported: false, text: "", truncated: false, kind: textualKind, note: `falha ao ler texto: ${(e as Error).message}` };
    }
  }

  const m = (mime || "").toLowerCase();
  const f = (filename || "").toLowerCase();
  if (m === "application/pdf" || f.endsWith(".pdf")) {
    try {
      const raw = await extractPdf(bytes);
      const cleaned = raw.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!cleaned) {
        return { supported: false, text: "", truncated: false, kind: "pdf", note: "PDF sem texto extraível (pode ser digitalizado/imagem)." };
      }
      const { text, truncated } = truncate(cleaned);
      return { supported: true, text, truncated, kind: "pdf" };
    } catch (e) {
      return { supported: false, text: "", truncated: false, kind: "pdf", note: `falha ao extrair PDF: ${(e as Error).message}` };
    }
  }

  return {
    supported: false,
    text: "",
    truncated: false,
    kind: "unsupported",
    note: `Formato ${mime || filename || "desconhecido"} ainda não suportado. Mande .md, .txt, .json ou .pdf.`,
  };
}
