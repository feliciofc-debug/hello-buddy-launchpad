import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  hasVideoPublicationRequest,
  selectPublicationMediaId,
} from "./owner-media-intent.ts";
import {
  deliveredMediaState,
  modelMediaIdPresentInUserText,
  parseReadyMediaAction,
  readyMediaActionButtons,
} from "./ready-media-actions.ts";

const VIDEO_ID = "12345678-1234-4123-8123-123456789abc";
const CAROUSEL_ID = "87654321-4321-4321-8321-cba987654321";

Deno.test("vídeo entregue encerra carrossel antigo e vence a publicação seguinte", () => {
  const deliveredAt = "2026-10-09T15:30:00.000Z";
  const result = deliveredMediaState({
    general: {
      pending_carousel: {
        media_id: CAROUSEL_ID,
        token: "deadbeef",
        stage: "awaiting_confirmation",
      },
    },
  }, VIDEO_ID, deliveredAt);

  assertEquals(
    (result.state.general as Record<string, unknown>).pending_carousel,
    null,
  );
  assertEquals(result.cancelledCarouselToken, "deadbeef");
  assertEquals(
    hasVideoPublicationRequest(
      "publicar no reels do facebook e instagram",
    ),
    true,
  );
  assertEquals(
    selectPublicationMediaId({
      lastInteraction: result.state.last_media_interaction as {
        media_id: string;
        at: string;
      },
      recentGenerated: {
        id: CAROUSEL_ID,
        created_at: "2026-10-09T15:00:00.000Z",
      },
      nowMs: Date.parse("2026-10-09T15:31:00.000Z"),
    }),
    VIDEO_ID,
  );
});

Deno.test("Publicar agora mantém exatamente o ID da mídia exibida", () => {
  const buttons = readyMediaActionButtons(VIDEO_ID, "video");
  const publish = buttons.buttons[0];
  const parsed = parseReadyMediaAction(
    `<<INTERACTIVE_ID:${publish.id}>>`,
  );

  assertEquals(parsed, {
    action: "publish",
    mediaType: "video",
    mediaId: VIDEO_ID,
  });
  assertStringIncludes(publish.id, VIDEO_ID);
});

Deno.test("ID inventado pelo modelo é descartado se não veio do usuário", () => {
  assertEquals(
    modelMediaIdPresentInUserText(
      "publicar no reels do facebook e instagram",
      CAROUSEL_ID,
    ),
    undefined,
  );
  assertEquals(
    modelMediaIdPresentInUserText(
      `publique a mídia ${VIDEO_ID}`,
      VIDEO_ID,
    ),
    VIDEO_ID,
  );
});
