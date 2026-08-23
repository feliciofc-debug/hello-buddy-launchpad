// ============================================================================
// WhatsApp Media Helper — baixa mídia da Graph API e converte para base64.
// ============================================================================

// A WhatsApp Cloud API limita vídeo recebido a 16MB. 20MB cobre tudo que pode chegar.
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const GRAPH_API_VERSION = "v25.0";

export type MediaExtract = {
  kind: "image" | "audio" | "video" | "document";
  mime: string;
  base64: string;
  caption?: string;
  filename?: string;
};

export type MediaRejection = {
  kind: MediaExtract["kind"];
  reason: "too_large" | "download_failed" | "meta_failed";
  bytes?: number;
  limitBytes: number;
};

export type MediaDownloadResult = {
  items: MediaExtract[];
  rejections: MediaRejection[];
};

export function extractMediaRefs(payload: any): Array<{
  kind: MediaExtract["kind"];
  id: string;
  mime: string;
  caption?: string;
  filename?: string;
}> {
  if (!payload) return [];
  const refs: Array<any> = [];
  if (payload.image?.id) refs.push({ kind: "image", id: payload.image.id, mime: payload.image.mime_type ?? "image/jpeg", caption: payload.image.caption });
  if (payload.audio?.id) refs.push({ kind: "audio", id: payload.audio.id, mime: payload.audio.mime_type ?? "audio/ogg" });
  if (payload.video?.id) refs.push({ kind: "video", id: payload.video.id, mime: payload.video.mime_type ?? "video/mp4", caption: payload.video.caption });
  if (payload.document?.id) refs.push({ kind: "document", id: payload.document.id, mime: payload.document.mime_type ?? "application/pdf", filename: payload.document.filename, caption: payload.document.caption });
  return refs;
}

export type DownloadOutcome =
  | { ok: true; base64: string; mime: string; bytes: number }
  | { ok: false; reason: "too_large" | "download_failed" | "meta_failed"; bytes?: number };

export async function downloadMediaDetailed(
  mediaId: string,
  accessToken: string,
): Promise<DownloadOutcome> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) {
      console.error(`[whatsapp-media] meta ${metaRes.status} para ${mediaId}`);
      return { ok: false, reason: "meta_failed" };
    }
    const meta = await metaRes.json();
    const url: string | undefined = meta?.url;
    const mime: string = meta?.mime_type ?? "application/octet-stream";
    const fileSize: number = Number(meta?.file_size ?? 0);
    if (!url) return { ok: false, reason: "meta_failed" };
    if (fileSize > MAX_MEDIA_BYTES) {
      console.warn(
        `[whatsapp-media] RECUSADA por tamanho: ${mediaId} mime=${mime} bytes=${fileSize} (${(fileSize / 1048576).toFixed(2)}MB) limite=${(MAX_MEDIA_BYTES / 1048576).toFixed(0)}MB`,
      );
      return { ok: false, reason: "too_large", bytes: fileSize };
    }

    const binRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!binRes.ok) {
      console.error(`[whatsapp-media] download ${binRes.status} para ${mediaId}`);
      return { ok: false, reason: "download_failed" };
    }
    const buf = new Uint8Array(await binRes.arrayBuffer());
    if (buf.byteLength > MAX_MEDIA_BYTES) {
      console.warn(
        `[whatsapp-media] RECUSADA por tamanho (pós-download): ${mediaId} bytes=${buf.byteLength} (${(buf.byteLength / 1048576).toFixed(2)}MB) limite=${(MAX_MEDIA_BYTES / 1048576).toFixed(0)}MB`,
      );
      return { ok: false, reason: "too_large", bytes: buf.byteLength };
    }

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return { ok: true, base64: btoa(binary), mime, bytes: buf.byteLength };
  } catch (e) {
    console.error(`[whatsapp-media] erro ${mediaId}:`, e);
    return { ok: false, reason: "download_failed" };
  }
}

export async function downloadMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ base64: string; mime: string; bytes: number } | null> {
  const r = await downloadMediaDetailed(mediaId, accessToken);
  return r.ok ? { base64: r.base64, mime: r.mime, bytes: r.bytes } : null;
}

export async function downloadAllMediaDetailed(
  payload: any,
  accessToken: string,
): Promise<MediaDownloadResult> {
  const refs = extractMediaRefs(payload);
  const out: MediaExtract[] = [];
  const rejections: MediaRejection[] = [];
  for (const ref of refs) {
    const dl = await downloadMediaDetailed(ref.id, accessToken);
    if (!dl.ok) {
      rejections.push({ kind: ref.kind, reason: dl.reason, bytes: dl.bytes, limitBytes: MAX_MEDIA_BYTES });
      continue;
    }
    out.push({ kind: ref.kind, mime: dl.mime || ref.mime, base64: dl.base64, caption: ref.caption, filename: ref.filename });
  }
  return { items: out, rejections };
}

export async function downloadAllMedia(
  payload: any,
  accessToken: string,
): Promise<MediaExtract[]> {
  const { items } = await downloadAllMediaDetailed(payload, accessToken);
  return items;
}

export { MAX_MEDIA_BYTES };
