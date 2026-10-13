import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkedWhatsappVideoUrl,
  hasWhatsappVideoDeliveryFailure,
  remoteVideoFitsWhatsapp,
  WHATSAPP_VIDEO_MAX_BYTES,
  whatsappVideoFallbackMessage,
} from "./whatsapp-video-delivery.ts";
import { mediaThenButtonPayloads } from "./whatsapp-media-buttons.ts";

Deno.test("vídeo de até 16 MiB pode ser enviado ao WhatsApp", async () => {
  const result = await remoteVideoFitsWhatsapp(
    "https://example.com/preview.mp4",
    () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-length": String(WHATSAPP_VIDEO_MAX_BYTES) },
        }),
      ),
  );
  assertEquals(result.fits, true);
  assertEquals(result.sizeBytes, WHATSAPP_VIDEO_MAX_BYTES);
});

Deno.test("vídeo acima de 16 MiB ou sem tamanho não pode virar POST de vídeo", async () => {
  const oversized = await remoteVideoFitsWhatsapp(
    "https://example.com/large.mp4",
    () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: {
            "content-length": String(WHATSAPP_VIDEO_MAX_BYTES + 1),
          },
        }),
      ),
  );
  const unknown = await remoteVideoFitsWhatsapp(
    "https://example.com/unknown.mp4",
    () => Promise.resolve(new Response(null, { status: 200 })),
  );
  assertEquals(oversized.fits, false);
  assertEquals(unknown.fits, false);
  const payloads = mediaThenButtonPayloads({
    to: "5511999999999",
    message: "Vídeo pronto",
    videoUrl: checkedWhatsappVideoUrl(
      "https://example.com/large.mp4",
      oversized,
    ),
    interactiveButtons: {
      buttons: [{ id: "publish", title: "Publicar" }],
    },
  });
  assertEquals(payloads, null);
});

Deno.test("fallback inclui o link do vídeo final", () => {
  const message = whatsappVideoFallbackMessage(
    "https://cdn.example.com/final.mp4",
  );
  assertStringIncludes(message, "grande demais para o WhatsApp");
  assertStringIncludes(message, "https://cdn.example.com/final.mp4");
});

Deno.test("status failed identifica falha de entrega, inclusive erro 131053", () => {
  assertEquals(
    hasWhatsappVideoDeliveryFailure({
      status: "failed",
      errors: [{ code: 131053 }],
    }),
    true,
  );
  assertEquals(
    hasWhatsappVideoDeliveryFailure({
      status: "failed",
      errors: [{ code: 999 }],
    }),
    true,
  );
  assertEquals(hasWhatsappVideoDeliveryFailure({ status: "read" }), false);
});
