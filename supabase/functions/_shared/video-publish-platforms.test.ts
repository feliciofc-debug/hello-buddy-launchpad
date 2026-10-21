import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  friendlyMetaVideoPublishError,
} from "./meta-video-requirements.ts";
import {
  loadConnectedPublishPlatforms,
  metaVideoPlatformLabel,
  notConnectedPublishMessage,
  readJobPublishedPosts,
  resolveVideoPublisher,
  shouldAttemptPublish,
  skipPublishMessage,
  uniqueVideoPublishPlatforms,
} from "./video-publish-platforms.ts";
import { formatVideoPublishMessage } from "./video-publish-message.ts";

Deno.test("Instagram feed usa meta-publish-instagram (AMZ tradicional)", () => {
  assertEquals(
    resolveVideoPublisher("instagram", "feed").kind,
    "meta-instagram",
  );
  assertEquals(
    resolveVideoPublisher("instagram", "reels").kind,
    "meta-reels",
  );
  assertEquals(resolveVideoPublisher("facebook", "feed").kind, "meta-post");
  assertEquals(
    resolveVideoPublisher("facebook", "reels").kind,
    "meta-reels",
  );
});

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

Deno.test("consulta de conexão com erro não bloqueia publicação", async () => {
  const chain = (result: { data: unknown; error: unknown }) => ({
    eq: () => chain(result),
    limit: () => Promise.resolve(result),
  });
  const sb = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              if (table === "meta_connections") {
                return chain({ data: null, error: { message: "multiple rows" } });
              }
              if (table === "linkedin_connections") {
                return chain({ data: [{ id: "li-1" }], error: null });
              }
              return chain({ data: [{ id: "tt-1" }], error: null });
            },
          };
        },
      };
    },
  };
  const connected = await loadConnectedPublishPlatforms(sb as never, "user-1");
  assertEquals(connected.facebook, null);
  assertEquals(connected.instagram, null);
  assertEquals(shouldAttemptPublish(connected, "facebook"), true);
  assertEquals(shouldAttemptPublish(connected, "linkedin"), true);
  assertEquals(connected.linkedin, true);
});

Deno.test("mensagens não conectado e skip formatam ❌ TIKTOK — motivo", () => {
  const notConnected = notConnectedPublishMessage("tiktok");
  assertEquals(
    notConnected,
    "TikTok: não conectado — conecte em Configurações.",
  );
  const skip = skipPublishMessage("tiktok", "não tem formato story — ignorado");
  assertEquals(skip, "TikTok: não tem formato story — ignorado");
  const message = formatVideoPublishMessage({
    published: [],
    errors: [notConnected, skip],
  });
  assertEquals(message.includes("❌ *TIKTOK* — não conectado"), true);
  assertEquals(message.includes("❌ *PUBLICAÇÃO*"), false);
});

Deno.test("mensagem parcial não repete erro para rede já publicada", () => {
  const message = formatVideoPublishMessage({
    published: ["facebook", "instagram"],
    links: [{
      plataforma: "facebook",
      url: "https://www.facebook.com/reel/123",
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
});
