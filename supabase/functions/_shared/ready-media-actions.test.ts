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
  imageEditRetryButtons,
  isImageEditRetryAction,
  modelMediaIdPresentInUserText,
  parseReadyMediaAction,
  parseReadyMediaScheduleChoice,
  parseReadyVideoRerenderAction,
  parseVideoCaptionChoice,
  readyMediaActionRoute,
  readyMediaButtonsAllowed,
  readyMediaActionButtons,
  readyMediaScheduleList,
  readyVideoPublishPlan,
  readyVideoRerenderButtons,
  replyTextFromInteractiveId,
  scheduleSlotSaoPauloText,
  videoCaptionChoiceButtons,
  videoCaptionOptionsText,
  whatsappLinkAtCaptionEnd,
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

Deno.test("foto oferece Ajustar imagem e vídeo mantém Trocar legenda", () => {
  const photoButtons = readyMediaActionButtons(VIDEO_ID, "foto");
  const videoButtons = readyMediaActionButtons(VIDEO_ID, "video");
  assertEquals(photoButtons.buttons[2].title, "🎨 Ajustar imagem");
  assertEquals(videoButtons.buttons[2].title, "✏️ Trocar legenda");
  assertEquals(
    parseReadyMediaAction(
      `<<INTERACTIVE_ID:${photoButtons.buttons[2].id}>>`,
    ),
    {
      action: "edit",
      mediaType: "foto",
      mediaId: VIDEO_ID,
    },
  );
});

Deno.test("falha de edição oferece nova tentativa acionável", () => {
  const retry = imageEditRetryButtons();
  assertEquals(retry.buttons[0].title, "🔄 Tentar de novo");
  assertEquals(
    isImageEditRetryAction(
      `<<INTERACTIVE_ID:${retry.buttons[0].id}>>`,
    ),
    true,
  );
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

Deno.test("opções A/B/C preservam a resposta digitada e vinculam troca à mídia", () => {
  assertEquals(
    replyTextFromInteractiveId("<<INTERACTIVE_ID:reply_text:B>>"),
    "B",
  );
  assertEquals(
    videoCaptionChoiceButtons().buttons.map((button) => button.title),
    ["Opção A", "Opção B", "Opção C"],
  );
  const choice = videoCaptionChoiceButtons(VIDEO_ID).buttons[2];
  assertEquals(
    parseVideoCaptionChoice(`<<INTERACTIVE_ID:${choice.id}>>`),
    { letter: "C", mediaId: VIDEO_ID },
  );
});

Deno.test("agendamento oferece quatro horários vinculados à mídia", () => {
  const list = readyMediaScheduleList(VIDEO_ID);
  assertEquals(list.rows.map((row) => row.title), [
    "Hoje 18h",
    "Amanhã 10h",
    "Amanhã 18h",
    "Outro horário",
  ]);
  assertEquals(
    parseReadyMediaScheduleChoice(
      `<<INTERACTIVE_ID:${list.rows[1].id}>>`,
    ),
    { slot: "tomorrow_10", mediaId: VIDEO_ID },
  );
  assertEquals(
    scheduleSlotSaoPauloText(
      "tomorrow_10",
      new Date("2026-10-09T12:00:00Z"),
    ),
    "2026-10-10 10:00",
  );
});

Deno.test("link do WhatsApp fica sempre no final da legenda publicada", () => {
  const caption = whatsappLinkAtCaptionEnd(
    "📱 Chame no WhatsApp: https://wa.me/5511000000000\n\nLegenda B\n\n#carro",
    "5592999999999",
  );
  assertEquals(
    caption,
    "Legenda B\n\n#carro\n\n📱 Chame no WhatsApp: https://wa.me/5592999999999",
  );
});

Deno.test("publicação do vídeo usa exatamente a opção escolhida sem novas variantes", () => {
  const optionB = "O verdadeiro luxo automotivo está nos detalhes.";
  const plan = readyVideoPublishPlan(optionB);
  assertEquals(plan.caption, optionB);
  assertEquals(plan.generateSocialVariants, false);
  assertEquals(plan.format, "reels");
  assertEquals(
    readyMediaActionRoute({
      action: "publish",
      mediaType: "video",
      isLegendVideoWithChosenCaption: true,
    }),
    "direct_video_publish",
  );
});

Deno.test("lead nunca recebe botões de mídia pronta", () => {
  assertEquals(readyMediaButtonsAllowed(false), false);
  assertEquals(readyMediaButtonsAllowed(true), true);
});

Deno.test("legendas longas ficam completas antes dos botões", () => {
  const longCaption = "x".repeat(2000);
  const text = videoCaptionOptionsText([
    "Opção curta A",
    longCaption,
    "Opção curta C",
  ]);
  assertStringIncludes(text, longCaption);
  assertEquals(text.includes("reply_text:"), false);
  assertEquals(videoCaptionChoiceButtons().body, "Escolha a legenda:");
});

Deno.test("sequência vídeo B publica direto em cinco etapas lógicas", () => {
  const options = ["Legenda A", "Legenda B escolhida", "Legenda C"];
  const messages = [
    videoCaptionOptionsText(options),
    videoCaptionChoiceButtons().body,
    "Legenda B escolhida ✅ Gerando o vídeo…",
    "vídeo pronto + ações",
    "✅ Publicado no Facebook e Instagram",
  ];
  const typedChoice = replyTextFromInteractiveId(
    "<<INTERACTIVE_ID:reply_text:B>>",
  );
  const chosen = options[["A", "B", "C"].indexOf(typedChoice)];
  const publishAction = parseReadyMediaAction(
    `<<INTERACTIVE_ID:${readyMediaActionButtons(VIDEO_ID, "video").buttons[0].id}>>`,
  );
  const plan = readyVideoPublishPlan(chosen);

  assertEquals(messages.length, 5);
  assertEquals(publishAction?.mediaId, VIDEO_ID);
  assertEquals(plan.caption, options[1]);
  assertEquals(plan.generateSocialVariants, false);
});

Deno.test("agendar e trocar legenda preservam a opção selecionada", () => {
  const optionB = "Legenda B";
  const schedulePlan = readyVideoPublishPlan(optionB);
  assertEquals(schedulePlan.caption, optionB);

  const choiceC = parseVideoCaptionChoice(
    `<<INTERACTIVE_ID:ready_media:caption_choice:C:video:${VIDEO_ID}>>`,
  );
  const options = ["Legenda A", optionB, "Legenda C"];
  const updated = options[["A", "B", "C"].indexOf(choiceC!.letter)];
  assertEquals(updated, "Legenda C");
  assertEquals(readyVideoPublishPlan(updated).caption, "Legenda C");
});

Deno.test("erro de formato oferece re-render 9:16 vinculado à mídia correta", () => {
  const buttons = readyVideoRerenderButtons(VIDEO_ID);
  assertEquals(buttons.buttons.length, 1);
  assertEquals(buttons.buttons[0].title, "🔄 Refazer em 9:16");
  assertEquals(buttons.buttons[0].title.length <= 20, true);
  assertEquals(
    parseReadyVideoRerenderAction(
      `<<INTERACTIVE_ID:${buttons.buttons[0].id}>>`,
    ),
    { mediaId: VIDEO_ID },
  );
});
