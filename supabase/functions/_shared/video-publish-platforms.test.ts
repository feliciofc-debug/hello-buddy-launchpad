import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  friendlyMetaVideoPublishError,
} from "./meta-video-requirements.ts";
import {
  metaVideoPlatformLabel,
  notConnectedPublishMessage,
  readJobPublishedPosts,
  resolveVideoPublisher,
  uniqueVideoPublishPlatforms,
} from "./video-publish-platforms.ts";
import { formatVideoPublishMessage } from "./video-publish-message.ts";

Deno.test("rótulo amigável distingue Facebook, Instagram, LinkedIn e TikTok", () => {
  assertEquals(metaVideoPlatformLabel("facebook"), "Facebook");
  assertEquals(metaVideoPlatformLabel("linkedin"), "LinkedIn");
  assertEquals(
    friendlyMetaVideoPublishError("linkedin", new Error("Graph error 403")),
    "LinkedIn: não consegui publicar o vídeo. Tente novamente.",
  );
  assertEquals(
    friendlyMetaVideoPublishError("tiktok", new Error("not_connected")),
    "TikTok não conectado — conecte em Configurações.",
  );
});

Deno.test("plataformas duplicadas são deduplicadas", () => {
  assertEquals(
    uniqueVideoPublishPlatforms([
      "facebook",
      "instagram",
      "facebook",
      "linkedin",
      "tiktok",
      "linkedin",
    ]),
    ["facebook", "instagram", "linkedin", "tiktok"],
  );
});

Deno.test("LinkedIn e TikTok usam publicadores próprios no Reels", () => {
  assertEquals(resolveVideoPublisher("linkedin", "reels").kind, "linkedin");
  assertEquals(resolveVideoPublisher("tiktok", "reels").kind, "tiktok");
  assertEquals(
    resolveVideoPublisher("facebook", "reels").kind,
    "meta-reels",
  );
});

Deno.test("mensagem parcial não repete erro para rede já publicada", () => {
  const message = formatVideoPublishMessage({
    published: ["facebook", "instagram"],
    links: [{
      plataforma: "facebook",
      url: "https://www.facebook.com/reel/1",
    }],
    errors: [
      "Facebook: não consegui publicar o vídeo. Tente novamente.",
      "LinkedIn: não consegui publicar o vídeo. Tente novamente.",
    ],
  });
  assertEquals(message.includes("PUBLICADO EM PARTE"), true);
  assertEquals(message.match(/❌ \*FACEBOOK\*/g)?.length, undefined);
  assertEquals(message.match(/❌ \*LINKEDIN\*/g)?.length, 1);
});

Deno.test("posts já gravados no job são reconhecidos", () => {
  const posts = readJobPublishedPosts({
    publicados: {
      facebook: { post_id: "123", post_url: "https://fb.test/1" },
    },
  });
  assertEquals(posts.facebook?.post_id, "123");
  assertEquals(
    notConnectedPublishMessage("tiktok"),
    "TikTok não conectado — conecte em Configurações.",
  );
});
