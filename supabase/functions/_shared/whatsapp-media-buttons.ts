import {
  singleLineInteractiveText,
  truncateCodePoints,
} from "./whatsapp-interactive-safe.ts";

type InteractiveButtons = {
  body?: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id?: string; title?: string }>;
};

function mediaPayload(input: {
  to: string;
  message?: string;
  videoUrl?: string;
  imageUrl?: string;
}): Record<string, unknown> | null {
  const to = input.to.replace(/\D/g, "");
  if (input.videoUrl) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: {
        link: input.videoUrl,
        caption: truncateCodePoints(input.message || "", 1024),
      },
    };
  }
  if (input.imageUrl) {
    return {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: input.imageUrl,
        caption: truncateCodePoints(input.message || "", 1024),
      },
    };
  }
  return null;
}

export function mediaThenInteractivePayloads(input: {
  to: string;
  message?: string;
  videoUrl?: string;
  imageUrl?: string;
  interactivePayload?: Record<string, unknown> | null;
}): Record<string, unknown>[] | null {
  if (!input.interactivePayload) return null;
  const media = mediaPayload(input);
  return media ? [media, input.interactivePayload] : null;
}

export function mediaThenButtonPayloads(input: {
  to: string;
  message?: string;
  videoUrl?: string;
  imageUrl?: string;
  interactiveButtons?: InteractiveButtons;
}): Record<string, unknown>[] | null {
  const buttonsInput = input.interactiveButtons;
  if (
    !buttonsInput?.buttons?.length ||
    (!input.videoUrl && !input.imageUrl)
  ) {
    return null;
  }

  const to = input.to.replace(/\D/g, "");
  const media = mediaPayload(input)!;
  const buttons = buttonsInput.buttons.slice(0, 3).map((button, index) => ({
    type: "reply",
    reply: {
      id: truncateCodePoints(button.id ?? `action_${index}`, 256),
      title: singleLineInteractiveText(
        button.title ?? `Opção ${index + 1}`,
        20,
      ),
    },
  }));
  const buttonPayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(buttonsInput.header
        ? {
          header: {
            type: "text",
            text: singleLineInteractiveText(buttonsInput.header, 60),
          },
        }
        : {}),
      body: {
        text: truncateCodePoints(
          buttonsInput.body || "O que você quer fazer agora?",
          1024,
        ),
      },
      ...(buttonsInput.footer
        ? {
          footer: {
            text: singleLineInteractiveText(buttonsInput.footer, 60),
          },
        }
        : {}),
      action: { buttons },
    },
  };
  return [media, buttonPayload];
}
