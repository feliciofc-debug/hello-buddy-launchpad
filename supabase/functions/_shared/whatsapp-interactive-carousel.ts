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

export type ImageHeaderButtonInput = {
  to: string;
  body: string;
  imageUrl: string;
  buttons: CarouselReplyButton[];
};

/** Corpo do card: ≤160 chars e no máximo 2 quebras de linha (3 linhas). */
export function sanitizeCarouselCardBody(text: string): string {
  const lines = String(text || "").trim().split("\n").slice(0, 3);
  return truncateCodePoints(lines.join("\n"), 160);
}

function mapQuickReplyButtons(buttons: CarouselReplyButton[]) {
  return buttons.slice(0, 2).map((button) => ({
    type: "quick_reply",
    quick_reply: {
      id: truncateCodePoints(button.id, 256),
      title: singleLineInteractiveText(button.title, 20),
    },
  }));
}

/** Monta payload Meta Cloud API (interactive carousel, doc: cta_url + quick_reply). */
export function buildInteractiveCarouselPayload(
  input: InteractiveCarouselInput,
): Record<string, unknown> {
  const to = input.to.replace(/\D/g, "");
  const sliced = input.cards.slice(0, 10);
  if (sliced.length < 2) {
    throw new Error("carousel_requires_min_2_cards");
  }

  const buttonCount = 2;
  const cards = sliced.map((card, index) => {
    const buttons = mapQuickReplyButtons(
      card.buttons.length >= buttonCount
        ? card.buttons
        : [
          ...card.buttons,
          ...Array.from({ length: buttonCount - card.buttons.length }, (_, i) => ({
            id: `veiculo_vitrine:noop:${index}:${i}`,
            title: "—",
          })),
        ],
    );
    return {
      card_index: card.card_index ?? index,
      type: "cta_url",
      header: {
        type: "image",
        image: { link: toMetaSafeImageUrl(card.imageUrl) },
      },
      body: {
        text: sanitizeCarouselCardBody(card.body),
      },
      action: {
        buttons,
      },
    };
  });

  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "carousel",
      body: {
        text: truncateCodePoints(input.body.trim() || "Veículos disponíveis", 1024),
      },
      action: {
        cards,
      },
    },
  };
}

/** Fallback vitrine: um balão interactive/button com header imagem + body + botões. */
export function buildInteractiveImageHeaderButtonPayload(
  input: ImageHeaderButtonInput,
): Record<string, unknown> {
  const to = input.to.replace(/\D/g, "");
  const buttons = input.buttons.slice(0, 3).map((button, index) => ({
    type: "reply",
    reply: {
      id: truncateCodePoints(button.id ?? `action_${index}`, 256),
      title: singleLineInteractiveText(button.title ?? `Opção ${index + 1}`, 20),
    },
  }));
  return {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "image",
        image: { link: toMetaSafeImageUrl(input.imageUrl) },
      },
      body: {
        text: truncateCodePoints(input.body || "Escolha uma opção", 1024),
      },
      action: { buttons },
    },
  };
}
