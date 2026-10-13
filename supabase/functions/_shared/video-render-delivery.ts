import { whatsappVideoFallbackMessage } from "./whatsapp-video-delivery.ts";

export function videoRenderWhatsappDelivery(
  finalVideoUrl: string,
  previewVideoUrl: string | null | undefined,
  readyMessage: string,
): {
  message: string;
  videoUrl?: string;
  fallbackUrl?: string;
} {
  if (!previewVideoUrl) {
    return { message: whatsappVideoFallbackMessage(finalVideoUrl) };
  }
  return {
    message: readyMessage,
    videoUrl: previewVideoUrl,
    fallbackUrl: finalVideoUrl,
  };
}
