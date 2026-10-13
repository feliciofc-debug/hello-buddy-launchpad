import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  friendlyMetaVideoPublishError,
  initialCaptionVideoFormat,
  metaVideoTarget,
  renderedMetaVideoFormat,
  shouldNotifyVideoPublishCaller,
  validateMetaVideoForPublishing,
} from "./meta-video-requirements.ts";
import { metadataEscolhaLogo } from "./video-legenda-logo.ts";
import { readyVideoPublishPlan } from "./ready-media-actions.ts";

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

Deno.test("cadeia padrão renderiza e valida vídeo legendado como Reels 9:16", () => {
  const options = ["Legenda A", "Legenda B", "Legenda C"];
  const chosenCaption = options[1];
  const format = initialCaptionVideoFormat("");
  const claim = metaVideoTarget(format);
  const metadata = metadataEscolhaLogo(
    { copy_letra: "B" },
    "B",
    {
      bucket: "tenant-logos",
      path: "tenant-id/video.png",
    },
  );
  const output = {
    ...claim,
    video_codec: "h264",
    audio_codec: "aac",
    has_audio: true,
    size_bytes: 20_000_000,
  };

  assertEquals(format, "reels");
  assertEquals(chosenCaption, "Legenda B");
  assertEquals(metadata.com_logo, true);
  assertEquals(readyVideoPublishPlan(chosenCaption).caption, "Legenda B");
  assertEquals(claim, {
    width: 1080,
    height: 1920,
    ratio: 1080 / 1920,
  });
  assertEquals(renderedMetaVideoFormat(format, output), "reels");
  assertEquals(
    validateMetaVideoForPublishing({
      format,
      path: "tenant/legendado.mp4",
      durationSeconds: 45,
      output,
    }),
    { ok: true },
  );
});

Deno.test("vídeo antigo 4:5 prevalece sobre formato Reels salvo por engano", () => {
  const output = {
    width: 1080,
    height: 1350,
    video_codec: "h264",
    audio_codec: "aac",
    has_audio: true,
    size_bytes: 20_000_000,
  };
  const renderedFormat = renderedMetaVideoFormat("reels", output);

  assertEquals(renderedFormat, "feed");
  assertEquals(
    validateMetaVideoForPublishing({
      format: renderedFormat,
      path: "tenant/antigo.mp4",
      durationSeconds: 45,
      output,
    }),
    { ok: true },
  );
});

Deno.test("formato explícito do dono vence o padrão Reels", () => {
  assertEquals(initialCaptionVideoFormat("quero no feed"), "feed");
  assertEquals(initialCaptionVideoFormat("publicar no story"), "story");
  assertEquals(initialCaptionVideoFormat("sem preferência"), "reels");
});

Deno.test("publicação chamada pelo processor não duplica mensagem de erro", () => {
  assertEquals(shouldNotifyVideoPublishCaller(false), false);
  assertEquals(shouldNotifyVideoPublishCaller(true), true);
  assertEquals(shouldNotifyVideoPublishCaller(undefined), true);
});
