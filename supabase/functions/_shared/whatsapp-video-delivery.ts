export const WHATSAPP_VIDEO_MAX_BYTES = 16 * 1024 * 1024;

export function whatsappVideoFallbackMessage(finalVideoUrl: string): string {
  return `🎬 Seu vídeo está pronto, mas é grande demais para o WhatsApp. Veja aqui: ${finalVideoUrl}`;
}

export function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}

export async function remoteVideoFitsWhatsapp(
  videoUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ fits: boolean; sizeBytes: number | null; reason: string }> {
  try {
    const response = await fetcher(videoUrl, { method: "HEAD" });
    if (!response.ok) {
      return {
        fits: false,
        sizeBytes: null,
        reason: `head_http_${response.status}`,
      };
    }
    const sizeBytes = parseContentLength(response.headers.get("content-length"));
    if (sizeBytes == null) {
      return { fits: false, sizeBytes: null, reason: "content_length_ausente" };
    }
    return {
      fits: sizeBytes <= WHATSAPP_VIDEO_MAX_BYTES,
      sizeBytes,
      reason: sizeBytes <= WHATSAPP_VIDEO_MAX_BYTES
        ? "dentro_do_limite"
        : "acima_de_16mb",
    };
  } catch (error) {
    return {
      fits: false,
      sizeBytes: null,
      reason: `head_erro:${
        error instanceof Error ? error.message.slice(0, 120) : "desconhecido"
      }`,
    };
  }
}

export function checkedWhatsappVideoUrl(
  videoUrl: string,
  check: { fits: boolean },
): string | undefined {
  return check.fits ? videoUrl : undefined;
}

export function hasWhatsappVideoDeliveryFailure(
  statusEvent: unknown,
): boolean {
  const event = statusEvent as { status?: unknown };
  return String(event?.status || "").toLowerCase() === "failed";
}
