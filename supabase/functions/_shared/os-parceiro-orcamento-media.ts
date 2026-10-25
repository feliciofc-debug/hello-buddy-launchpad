import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { extractDocumentText } from "./document-extract.ts";
import type { MediaExtract } from "./whatsapp-media.ts";
import { parseOrcamentoParceiroTexto } from "./os-parceiro-parser.ts";

const ORCAMENTO_VISION_MODEL = "google/gemini-3.1-pro-preview";

const ORCAMENTO_VISION_PROMPT = `Você lê um ORÇAMENTO COMERCIAL de oficina/parceiro (PDF ou foto).
Devolva JSON PURO (sem markdown):
{"texto_util":"trecho com valor total e prazo se existir","valor":1950.00,"prazo_dias":7,"legivel":true}
Regras: valor em número (reais); prazo_dias inteiro; se ilegível legivel=false; não invente.`;

export async function textoDeOrcamentoParceiroMedia(
  media: MediaExtract,
): Promise<string> {
  if (media.kind === "document" || media.mime.includes("pdf")) {
    const extracted = await extractDocumentText(
      media.base64,
      media.mime,
      media.filename,
    );
    if (extracted.text?.trim()) return extracted.text;
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
  if (!apiKey) return "";

  const label = media.filename || "orcamento";
  try {
    const vr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ORCAMENTO_VISION_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: ORCAMENTO_VISION_PROMPT },
            media.mime.includes("pdf")
              ? {
                type: "file",
                file: {
                  filename: label,
                  file_data: `data:${media.mime};base64,${media.base64}`,
                },
              }
              : {
                type: "image_url",
                image_url: { url: `data:${media.mime};base64,${media.base64}` },
              },
          ],
        }],
      }),
    });
    if (!vr.ok) return "";
    const vj = await vr.json();
    const raw = String(vj?.choices?.[0]?.message?.content ?? "{}");
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    try {
      const j = JSON.parse(cleaned) as {
        texto_util?: string;
        valor?: number;
        prazo_dias?: number;
      };
      const parts = [j.texto_util ?? ""];
      if (j.valor != null) parts.push(`R$ ${j.valor}`);
      if (j.prazo_dias != null) parts.push(`${j.prazo_dias} dias`);
      return parts.filter(Boolean).join(" · ");
    } catch {
      return cleaned.slice(0, 2000);
    }
  } catch {
    return "";
  }
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
