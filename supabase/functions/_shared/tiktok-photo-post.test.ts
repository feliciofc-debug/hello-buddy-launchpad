import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildTikTokPhotoPostPayload,
  tikTokPhotoInitErrorMessage,
} from "./tiktok-photo-post.ts";

Deno.test("foto TikTok usa Content Posting API com PULL_FROM_URL", () => {
  const payload = buildTikTokPhotoPostPayload({
    imageUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
    caption: "Legenda escolhida",
    directPost: true,
    privacyLevel: "SELF_ONLY",
    brandOrganic: true,
  }) as any;

  assertEquals(payload.media_type, "PHOTO");
  assertEquals(payload.post_mode, "DIRECT_POST");
  assertEquals(payload.source_info, {
    source: "PULL_FROM_URL",
    photo_cover_index: 0,
    photo_images: [
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
    ],
  });
  assertEquals(payload.post_info.description, "Legenda escolhida");
  assertEquals(payload.post_info.privacy_level, "SELF_ONLY");
  assertEquals(payload.post_info.brand_organic_toggle, true);
});

Deno.test("domínio não verificado no TikTok produz orientação clara", () => {
  const message = tikTokPhotoInitErrorMessage(400, {
    code: "url_ownership_unverified",
    message: "URL ownership verification failed",
  });
  assertStringIncludes(message, "verifique o domínio no painel do TikTok");
});
