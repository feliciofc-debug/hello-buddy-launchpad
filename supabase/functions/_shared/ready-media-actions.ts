export type ReadyMediaType = "foto" | "video";
export type ReadyMediaAction = "publish" | "schedule" | "caption";

export type ReadyMediaButtonAction = {
  action: ReadyMediaAction;
  mediaType: ReadyMediaType;
  mediaId: string;
};

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
        title: "✏️ Ajustar legenda",
      },
    ],
  };
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
