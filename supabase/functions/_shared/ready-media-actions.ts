export type ReadyMediaType = "foto" | "video";
export type ReadyMediaAction = "publish" | "schedule" | "caption";

export type ReadyMediaButtonAction = {
  action: ReadyMediaAction;
  mediaType: ReadyMediaType;
  mediaId: string;
};

export type ReadyMediaScheduleSlot =
  | "today_18"
  | "tomorrow_10"
  | "tomorrow_18"
  | "custom";

const MEDIA_ID_RE =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i;

export function readyMediaActionButtons(
  mediaId: string,
  mediaType: ReadyMediaType,
) {
  return {
    header: "Mídia pronta",
    body: "O que você quer fazer agora?",
    buttons: [
      {
        id: `ready_media:publish:${mediaType}:${mediaId}`,
        title: "📤 Publicar agora",
      },
      {
        id: `ready_media:schedule:${mediaType}:${mediaId}`,
        title: "🗓️ Agendar",
      },
      {
        id: `ready_media:caption:${mediaType}:${mediaId}`,
        title: "✏️ Trocar legenda",
      },
    ],
  };
}

export function readyVideoRerenderButtons(mediaId: string) {
  return {
    body: "Posso ajustar o formato deste vídeo:",
    buttons: [{
      id: `ready_media:rerender_reels:video:${mediaId}`,
      title: "🔄 Refazer em 9:16",
    }],
  };
}

export function parseReadyVideoRerenderAction(
  text: string,
): { mediaId: string } | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:ready_media:rerender_reels:video:([0-9a-f-]+)>>/i,
  );
  if (!match || !MEDIA_ID_RE.test(match[1])) return null;
  return { mediaId: match[1].toLowerCase() };
}

export function videoCaptionChoiceButtons(mediaId?: string) {
  return {
    body: "Escolha a legenda:",
    buttons: (["A", "B", "C"] as const).map((letter) => ({
      id: mediaId
        ? `ready_media:caption_choice:${letter}:video:${mediaId}`
        : `reply_text:${letter}`,
      title: `Opção ${letter}`,
    })),
  };
}

export function videoCaptionOptionsText(options: string[]): string {
  const letters = ["A", "B", "C"];
  const blocks = options.map((option, index) =>
    `*Opção ${letters[index]}*\n${option}`
  ).join("\n\n———\n\n");
  return `🎬 Assisti seu vídeo e transcrevi a fala. Fiz 3 legendas:\n\n${blocks}`;
}

export function parseVideoCaptionChoice(
  text: string,
): { letter: "A" | "B" | "C"; mediaId: string } | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:ready_media:caption_choice:([ABC]):video:([0-9a-f-]+)>>/i,
  );
  if (!match || !MEDIA_ID_RE.test(match[2])) return null;
  return {
    letter: match[1].toUpperCase() as "A" | "B" | "C",
    mediaId: match[2].toLowerCase(),
  };
}

export function readyMediaScheduleList(mediaId: string) {
  return {
    body: "Quando você quer publicar este vídeo?",
    button: "Escolher horário",
    section_title: "Horários",
    rows: [
      {
        id: `ready_media:schedule_at:today_18:video:${mediaId}`,
        title: "Hoje 18h",
      },
      {
        id: `ready_media:schedule_at:tomorrow_10:video:${mediaId}`,
        title: "Amanhã 10h",
      },
      {
        id: `ready_media:schedule_at:tomorrow_18:video:${mediaId}`,
        title: "Amanhã 18h",
      },
      {
        id: `ready_media:schedule_at:custom:video:${mediaId}`,
        title: "Outro horário",
      },
    ],
  };
}

export function parseReadyMediaScheduleChoice(
  text: string,
): { slot: ReadyMediaScheduleSlot; mediaId: string } | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:ready_media:schedule_at:(today_18|tomorrow_10|tomorrow_18|custom):video:([0-9a-f-]+)>>/i,
  );
  if (!match || !MEDIA_ID_RE.test(match[2])) return null;
  return {
    slot: match[1].toLowerCase() as ReadyMediaScheduleSlot,
    mediaId: match[2].toLowerCase(),
  };
}

export function scheduleSlotSaoPauloText(
  slot: Exclude<ReadyMediaScheduleSlot, "custom">,
  now = new Date(),
): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const localMiddayUtc = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12),
  );
  if (slot.startsWith("tomorrow")) {
    localMiddayUtc.setUTCDate(localMiddayUtc.getUTCDate() + 1);
  }
  const date = localMiddayUtc.toISOString().slice(0, 10);
  const hour = slot.endsWith("_10") ? "10:00" : "18:00";
  return `${date} ${hour}`;
}

export function whatsappLinkAtCaptionEnd(
  caption: string,
  phoneDigits?: string | null,
): string {
  const existing = String(caption || "").match(
    /(?:https?:\/\/)?wa\.me\/(\d{10,15})/i,
  )?.[1];
  const digits = String(phoneDigits || existing || "").replace(/\D/g, "");
  const body = String(caption || "")
    .replace(
      /(?:📱\s*)?(?:fale|chame|falar)\s+(?:comigo\s+)?(?:agora\s+)?(?:no|pelo)\s+whatsapp\s*:?\s*(?:https?:\/\/)?wa\.me\/\d+/gi,
      " ",
    )
    .replace(/(?:https?:\/\/)?wa\.me\/\d+/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!digits) return body;
  return [body, `📱 Chame no WhatsApp: https://wa.me/${digits}`]
    .filter(Boolean)
    .join("\n\n");
}

export function readyVideoPublishPlan(
  chosenCaption: string,
  phoneDigits?: string | null,
) {
  return {
    caption: whatsappLinkAtCaptionEnd(chosenCaption, phoneDigits),
    format: "reels" as const,
    networks: ["facebook", "instagram"] as const,
    generateSocialVariants: false as const,
  };
}

export function readyMediaActionRoute(input: {
  action: ReadyMediaAction;
  mediaType: ReadyMediaType;
  isLegendVideoWithChosenCaption: boolean;
}):
  | "direct_video_publish"
  | "direct_video_schedule"
  | "video_caption_choices"
  | "social_variants" {
  if (
    input.mediaType !== "video" || !input.isLegendVideoWithChosenCaption
  ) {
    return "social_variants";
  }
  if (input.action === "publish") return "direct_video_publish";
  if (input.action === "schedule") return "direct_video_schedule";
  return "video_caption_choices";
}

export function replyTextFromInteractiveId(text: string): string {
  return String(text || "").replace(
    /<<INTERACTIVE_ID:reply_text:([^>]+)>>/i,
    (_match, reply) => String(reply).trim(),
  );
}

export function readyMediaButtonsAllowed(isOwner: boolean): boolean {
  return isOwner;
}

export function parseReadyMediaAction(
  text: string,
): ReadyMediaButtonAction | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:ready_media:(publish|schedule|caption):(foto|video):([0-9a-f-]+)>>/i,
  );
  if (!match || !MEDIA_ID_RE.test(match[3])) return null;
  return {
    action: match[1].toLowerCase() as ReadyMediaAction,
    mediaType: match[2].toLowerCase() as ReadyMediaType,
    mediaId: match[3].toLowerCase(),
  };
}

export function modelMediaIdPresentInUserText(
  userText: string,
  modelMediaId: unknown,
): string | undefined {
  const id = String(modelMediaId || "").trim();
  if (!id || !MEDIA_ID_RE.test(id)) return undefined;
  return String(userText || "").toLowerCase().includes(id.toLowerCase())
    ? id
    : undefined;
}

export function deliveredMediaState(
  current: Record<string, unknown>,
  mediaId: string,
  at: string,
): {
  state: Record<string, unknown>;
  cancelledCarouselToken?: string;
} {
  const general = current.general &&
      typeof current.general === "object"
    ? current.general as Record<string, unknown>
    : {};
  const pending = (general.pending_carousel ?? current.pending_carousel) as
    | { token?: unknown }
    | null
    | undefined;
  const token = typeof pending?.token === "string" ? pending.token : undefined;

  return {
    state: {
      ...current,
      pending_carousel: null,
      general: {
        ...general,
        pending_carousel: null,
      },
      last_media_interaction: {
        media_id: mediaId,
        at,
      },
    },
    cancelledCarouselToken: token,
  };
}
