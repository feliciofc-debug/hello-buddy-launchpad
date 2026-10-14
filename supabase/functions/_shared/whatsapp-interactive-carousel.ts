import { toMetaSafeImageUrl } from "./meta-media.ts";
import {
  singleLineInteractiveText,
  truncateCodePoints,
} from "./whatsapp-interactive-safe.ts";

export type CarouselReplyButton = {
  id: string;
  title: string;
};

export type CarouselCardInput = {
  card_index: number;
  imageUrl: string;
  body: string;
  buttons: CarouselReplyButton[];
};

export type InteractiveCarouselInput = {
  to: string;
  body: string;
  cards: CarouselCardInput[];
};

/** Monta payload Meta Cloud API (interactive carousel com até 2 reply/card). */
export function buildInteractiveCarouselPayload(
  input: InteractiveCarouselInput,
): Record<string, unknown> {
  const to = input.to.replace(/\D/g, "");
  const cards = input.cards.slice(0, 10).map((card) => ({
    card_index: card.card_index,
    type: "button",
    header: {
      type: "image",
      image: { link: toMetaSafeImageUrl(card.imageUrl) },
    },
    body: {
      text: truncateCodePoints(card.body, 160),
    },
    action: {
      buttons: card.buttons.slice(0, 2).map((button) => ({
        type: "reply",
        reply: {
          id: truncateCodePoints(button.id, 256),
          title: singleLineInteractiveText(button.title, 20),
        },
      })),
    },
  }));

  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "carousel",
      body: {
        text: truncateCodePoints(input.body, 1024),
      },
      action: {
        cards,
      },
    },
  };
}
