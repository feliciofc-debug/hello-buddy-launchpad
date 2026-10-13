import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { videoRenderWhatsappDelivery } from "./video-render-delivery.ts";

Deno.test("complete entrega a prévia no WhatsApp e preserva o final para fallback", () => {
  const delivery = videoRenderWhatsappDelivery(
    "https://cdn.example.com/final.mp4",
    "https://cdn.example.com/preview.mp4",
    "Vídeo pronto",
  );
  assertEquals(delivery.videoUrl, "https://cdn.example.com/preview.mp4");
  assertEquals(delivery.fallbackUrl, "https://cdn.example.com/final.mp4");
  assertEquals(delivery.message, "Vídeo pronto");
});

Deno.test("complete sem prévia entrega link final e não tenta POST de vídeo", () => {
  const delivery = videoRenderWhatsappDelivery(
    "https://cdn.example.com/final.mp4",
    null,
    "Vídeo pronto",
  );
  assertEquals(delivery.videoUrl, undefined);
  assertStringIncludes(delivery.message, "https://cdn.example.com/final.mp4");
});
