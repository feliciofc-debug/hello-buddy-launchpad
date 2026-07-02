// ============================================================================
// WhatsApp Media Helper — baixa mídia da Graph API e converte para base64.
// ============================================================================

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const GRAPH_API_VERSION = "v22.0";

export type MediaExtract = {
  kind: "image" | "audio" | "video" | "document";
  mime: string;
  base64: string;
  caption?: string;
  filename?: string;
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

export async function downloadMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ base64: string; mime: string; bytes: number } | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) {
      console.error(`[whatsapp-media] meta ${metaRes.status} para ${mediaId}`);
      return null;
    }
    const meta = await metaRes.json();
    const url: string | undefined = meta?.url;
    const mime: string = meta?.mime_type ?? "application/octet-stream";
    const fileSize: number = Number(meta?.file_size ?? 0);
    if (!url) return null;
    if (fileSize > MAX_MEDIA_BYTES) {
      console.warn(`[whatsapp-media] mídia grande (${fileSize}) rejeitada`);
      return null;
    }

    const binRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!binRes.ok) return null;
    const buf = new Uint8Array(await binRes.arrayBuffer());
    if (buf.byteLength > MAX_MEDIA_BYTES) return null;

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    return { base64: btoa(binary), mime, bytes: buf.byteLength };
  } catch (e) {
    console.error(`[whatsapp-media] erro ${mediaId}:`, e);
    return null;
  }
}

export async function downloadAllMedia(
  payload: any,
  accessToken: string,
): Promise<MediaExtract[]> {
  const refs = extractMediaRefs(payload);
  if (refs.length === 0) return [];
  const out: MediaExtract[] = [];
  for (const ref of refs) {
    const dl = await downloadMedia(ref.id, accessToken);
    if (!dl) continue;
    out.push({ kind: ref.kind, mime: dl.mime || ref.mime, base64: dl.base64, caption: ref.caption, filename: ref.filename });
  }
  return out;
}
