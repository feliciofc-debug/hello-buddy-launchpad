import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tryProcessGestaoLucroInbound } from "./gestao-inbound.ts";
import {
  imageEditRetryButtons,
  isImageEditRetryAction,
  parseReadyMediaAction,
  parseReadyMediaScheduleChoice,
  parseReadyVideoRerenderAction,
  parseVideoCaptionChoice,
  readyMediaActionButtons,
  readyMediaScheduleList,
  readyVideoRerenderButtons,
} from "./ready-media-actions.ts";
import {
  stripWhatsAppInteractiveMarkers,
} from "./whatsapp-interactive-id.ts";
import {
  parseVehicleBrandPosition,
  vehicleBrandPositionList,
} from "./vehicle-brand-actions.ts";

const MEDIA_ID = "12345678-1234-4123-8123-123456789abc";
const COFRE_UUID = "8222abcd-1111-2222-3333-444455556666";

/** Espelha extractText (botão) + processOne → userTextComAudio → buildUserContent sem mídia. */
function buildProcessOneGeminiUserContent(
  userText: string,
  opts?: { audioTranscript?: string | null; metaAdsJarvisOriginalText?: string | null },
): string {
  const audioTranscript = opts?.audioTranscript ?? null;
  const metaAdsJarvisOriginalText = opts?.metaAdsJarvisOriginalText ?? null;
  const userTextComAudio = metaAdsJarvisOriginalText ??
    (audioTranscript
      ? `${userText ? `${userText}\n\n` : ""}🎙️ TRANSCRIÇÃO DO ÁUDIO: "${audioTranscript}"`
      : userText);
  return userTextComAudio || "(mensagem sem texto)";
}

function buttonUserText(title: string, id: string): string {
  return `${title}\n<<INTERACTIVE_ID:${id}>>`;
}

function parseAnuncioClienteId(userContent: string): string | null {
  return userContent.match(
    /<<INTERACTIVE_ID:(anuncio_(?:use_amz|other_store|send_client_logo))>>/i,
  )?.[1]?.toLowerCase() ?? null;
}

function parseBrandId(userContent: string): string {
  return userContent.match(/<<INTERACTIVE_ID:(brand_[^>]+)>>/i)?.[1]?.toLowerCase() ||
    "";
}

function parseSocialId(userContent: string): string {
  return userContent.match(/<<INTERACTIVE_ID:(social_[^>]+)>>/i)?.[1] || "";
}

function parseFipeId(userContent: string): string | null {
  return userContent.match(
    /<<INTERACTIVE_ID:(fipe_model:(?:\d+|more:\d+)|fipe_year:\d+|fipe_price:retry|fipe_ad:(?:queried|supplied))>>/i,
  )?.[1]?.toLowerCase() ?? null;
}

function parseVideoInteractiveId(text: string): string | null {
  return String(text).match(/<<INTERACTIVE_ID:(video_[a-z0-9_-]+)>>/i)?.[1] ?? null;
}

Deno.test("ESTAB-1.2 — userContent do processOne preserva marcador (anuncio_use_amz)", () => {
  const userText = buttonUserText("Usar marca da AMZ", "anuncio_use_amz");
  const userContent = buildProcessOneGeminiUserContent(userText);
  assertEquals(parseAnuncioClienteId(userContent), "anuncio_use_amz");
});

Deno.test("ESTAB-1.2 — famílias anuncio cliente no userContent", () => {
  for (const id of ["anuncio_use_amz", "anuncio_other_store", "anuncio_send_client_logo"]) {
    const userContent = buildProcessOneGeminiUserContent(buttonUserText("Título", id));
    assertEquals(parseAnuncioClienteId(userContent), id);
  }
});

Deno.test("ESTAB-1.2 — brand_* e social_* no userContent", () => {
  const brandContent = buildProcessOneGeminiUserContent(
    buttonUserText("Logo do site", "brand_image_site"),
  );
  assertEquals(parseBrandId(brandContent), "brand_image_site");

  const socialContent = buildProcessOneGeminiUserContent(
    buttonUserText("Publicar", "social_publish:abc123"),
  );
  assertEquals(parseSocialId(socialContent), "social_publish:abc123");
});

Deno.test("ESTAB-1.2 — ready_media:* no userContent", () => {
  const publish = readyMediaActionButtons(MEDIA_ID, "video").buttons[0];
  const userContent = buildProcessOneGeminiUserContent(
    buttonUserText(publish.title, publish.id),
  );
  assertEquals(parseReadyMediaAction(userContent), {
    action: "publish",
    mediaType: "video",
    mediaId: MEDIA_ID,
  });

  const scheduleRow = readyMediaScheduleList(MEDIA_ID).rows[0];
  const scheduleContent = buildProcessOneGeminiUserContent(
    `${scheduleRow.title}\n<<INTERACTIVE_ID:${scheduleRow.id}>>`,
  );
  assertEquals(parseReadyMediaScheduleChoice(scheduleContent)?.mediaId, MEDIA_ID);

  const captionButtons = parseVideoCaptionChoice;
  const captionId = `ready_media:caption_choice:B:video:${MEDIA_ID}`;
  const captionContent = buildProcessOneGeminiUserContent(
    buttonUserText("Opção B", captionId),
  );
  assertEquals(captionButtons(captionContent)?.letter, "B");

  const rerender = readyVideoRerenderButtons(MEDIA_ID).buttons[0];
  const rerenderContent = buildProcessOneGeminiUserContent(
    buttonUserText(rerender.title, rerender.id),
  );
  assertEquals(parseReadyVideoRerenderAction(rerenderContent)?.mediaId, MEDIA_ID);
});

Deno.test("ESTAB-1.2 — posição da marca e retry de edição no userContent", () => {
  const row = vehicleBrandPositionList(MEDIA_ID).rows[0];
  const brandPosContent = buildProcessOneGeminiUserContent(
    `${row.title}\n<<INTERACTIVE_ID:${row.id}>>`,
  );
  assertEquals(parseVehicleBrandPosition(brandPosContent)?.mediaId, MEDIA_ID);

  const retry = imageEditRetryButtons().buttons[0];
  const retryContent = buildProcessOneGeminiUserContent(
    buttonUserText(retry.title, retry.id),
  );
  assertEquals(isImageEditRetryAction(retryContent), true);
});

Deno.test("ESTAB-1.2 — fipe_* e video_* no userContent", () => {
  const fipeContent = buildProcessOneGeminiUserContent(
    buttonUserText("Versão", "fipe_model:3"),
  );
  assertEquals(parseFipeId(fipeContent), "fipe_model:3");

  const videoContent = buildProcessOneGeminiUserContent(
    buttonUserText("Continuar", "video_draft_confirm"),
  );
  assertEquals(parseVideoInteractiveId(videoContent), "video_draft_confirm");
});

Deno.test("ESTAB-1.2 — despesa fantasma: Gestão com texto limpo + interactiveId do cofre", async () => {
  const raw =
    `Não é documento\n<<INTERACTIVE_ID:cofre_possivel_liberar:${COFRE_UUID}>>`;
  const gestaoText = stripWhatsAppInteractiveMarkers(raw);
  let dbTouched = false;
  const result = await tryProcessGestaoLucroInbound({
    sb: {
      from: () => {
        dbTouched = true;
        throw new Error("não deveria consultar");
      },
    },
    userId: "u1",
    fromNumber: "5521888776655",
    userText: gestaoText,
    interactiveId: `cofre_possivel_liberar:${COFRE_UUID}`,
    hasInboundMedia: false,
    auth: {
      ownerPhone: "5521888776655",
      ownerAltPhones: [],
      gestores: [],
    },
    agentState: {},
    saveAgentStatePatch: async () => true,
  });
  assertEquals(gestaoText, "Não é documento");
  assertEquals(result.handled, false);
  assertEquals(dbTouched, false);
});
