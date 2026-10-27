import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { extractDocumentText } from "./document-extract.ts";
import { isProtectedDocumentMedia } from "./documento-portao.ts";
import type { MediaExtract } from "./whatsapp-media.ts";
import { parseOrcamentoParceiroTexto } from "./os-parceiro-parser.ts";

export async function textoDeOrcamentoParceiroMedia(
  media: MediaExtract,
): Promise<string> {
  if (isProtectedDocumentMedia(media)) return "";
  if (media.kind === "document" || media.mime.includes("pdf")) {
    const extracted = await extractDocumentText(
      media.base64,
      media.mime,
      media.filename,
    );
    if (extracted.text?.trim()) return extracted.text;
  }
  // Imagem/PDF digitalizado sem camada de texto fica para conferência humana.
  // Bytes de arquivo recebido no WhatsApp nunca são enviados a visão externa.
  return "";
}

export async function salvarOrcamentoParceiroDocumento(
  sb: SupabaseClient,
  input: {
    userId: string;
    osId: string;
    media: MediaExtract;
  },
): Promise<string | null> {
  const bytes = base64Decode(input.media.base64);
  const ext = input.media.filename?.split(".").pop()
    || (input.media.kind === "image" ? "jpg" : "pdf");
  const path = `${input.userId}/os/${input.osId}/${crypto.randomUUID()}-orcamento-parceiro.${ext}`;
  const { error: upErr } = await sb.storage.from("gestao-os-documentos").upload(path, bytes, {
    contentType: input.media.mime,
    upsert: false,
  });
  if (upErr) return null;
  await sb.from("gestao_os_documento").insert({
    user_id: input.userId,
    os_id: input.osId,
    tipo: "orcamento",
    storage_path: path,
    mime_type: input.media.mime,
    tamanho_bytes: bytes.byteLength,
  });
  return path;
}

export async function prepararOrcamentoParceiroDocumento(
  sb: SupabaseClient,
  input: {
    userId: string;
    osId: string;
    media: MediaExtract;
  },
): Promise<{
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
} | null> {
  const bytes = base64Decode(input.media.base64);
  const ext = input.media.filename?.split(".").pop()
    || (input.media.kind === "image" ? "jpg" : "pdf");
  const path = `${input.userId}/os/${input.osId}/${crypto.randomUUID()}-orcamento-parceiro.${ext}`;
  const { error } = await sb.storage.from("gestao-os-documentos").upload(path, bytes, {
    contentType: input.media.mime,
    upsert: false,
  });
  if (error) return null;
  return {
    storage_path: path,
    mime_type: input.media.mime,
    tamanho_bytes: bytes.byteLength,
  };
}

export async function confirmarOrcamentoParceiroDocumento(
  sb: SupabaseClient,
  input: {
    userId: string;
    osId: string;
    storagePath: string;
    mimeType: string;
    tamanhoBytes: number;
  },
): Promise<void> {
  await sb.from("gestao_os_documento").insert({
    user_id: input.userId,
    os_id: input.osId,
    tipo: "orcamento",
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    tamanho_bytes: input.tamanhoBytes,
  });
}

export async function descartarOrcamentoParceiroPreparado(
  sb: SupabaseClient,
  storagePath: string | null | undefined,
): Promise<void> {
  if (!storagePath) return;
  await sb.storage.from("gestao-os-documentos").remove([storagePath]);
}

export async function salvarAudioParceiroDocumento(
  sb: SupabaseClient,
  input: {
    userId: string;
    osId: string;
    media: MediaExtract;
  },
): Promise<string | null> {
  if (input.media.kind !== "audio") return null;
  return salvarOrcamentoParceiroDocumento(sb, {
    userId: input.userId,
    osId: input.osId,
    media: { ...input.media, filename: input.media.filename ?? "audio.ogg" },
  });
}

export function parseOrcamentoFromExtractedText(text: string) {
  return parseOrcamentoParceiroTexto(text);
}
