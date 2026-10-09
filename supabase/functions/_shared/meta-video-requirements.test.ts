import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  friendlyMetaVideoPublishError,
  metaVideoTarget,
  validateMetaVideoForPublishing,
} from "./meta-video-requirements.ts";

Deno.test("vídeo legendado 9:16 H.264 + AAC fica apto para Reels", () => {
  assertEquals(metaVideoTarget("reels"), {
    width: 1080,
    height: 1920,
    ratio: 1080 / 1920,
  });
  assertEquals(
    validateMetaVideoForPublishing({
      format: "reels",
      path: "tenant/legendado.mp4",
      durationSeconds: 45,
      sizeBytes: 20_000_000,
      output: {
        width: 1080,
        height: 1920,
        video_codec: "h264",
        audio_codec: "aac",
        has_audio: true,
        size_bytes: 20_000_000,
      },
    }),
    { ok: true },
  );
});

Deno.test("vídeo fora do contrato não pode ser reportado como publicado", () => {
  assertEquals(
    validateMetaVideoForPublishing({
      format: "story",
      path: "tenant/legendado.webm",
      durationSeconds: 75,
      output: null,
      sizeBytes: 10,
    }).ok,
    false,
  );
  assertEquals(
    friendlyMetaVideoPublishError(
      "instagram",
      new Error("processamento ainda não terminou"),
    ),
    "Instagram: o vídeo ainda está processando. Vou manter para tentar novamente.",
  );
});
