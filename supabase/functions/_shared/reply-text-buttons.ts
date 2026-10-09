export type ReplyTextButtons = {
  body: string;
  buttons: Array<{ id: string; title: string }>;
};

export type ReplyTextList = {
  body: string;
  button: string;
  section_title: string;
  rows: Array<{ id: string; title: string }>;
};

type ReplyChoice = { value: string; title: string };

export function replyTextFromInteractive(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:reply_text:([^>]{1,80})>>/i,
  );
  return match?.[1]?.trim() || null;
}

function controls(choices: ReplyChoice[]): {
  interactiveButtons?: ReplyTextButtons;
  interactiveList?: ReplyTextList;
} {
  if (choices.length <= 3) {
    return {
      interactiveButtons: {
        body: "Escolha uma opção:",
        buttons: choices.map((choice) => ({
          id: `reply_text:${choice.value}`,
          title: choice.title,
        })),
      },
    };
  }
  return {
    interactiveList: {
      body: "Escolha uma opção:",
      button: "Escolher",
      section_title: "Opções",
      rows: choices.map((choice) => ({
        id: `reply_text:${choice.value}`,
        title: choice.title,
      })),
    },
  };
}

export function replyTextControlsForMessage(message: string): {
  interactiveButtons?: ReplyTextButtons;
  interactiveList?: ReplyTextList;
} | null {
  const text = String(message || "");
  const hasCancel = /\*CANCELAR\*/i.test(text);

  if (/\*A\*[\s\S]{0,30}\*B\*[\s\S]{0,30}\*C\*/i.test(text)) {
    return controls([
      { value: "A", title: "Opção A" },
      { value: "B", title: "Opção B" },
      { value: "C", title: "Opção C" },
      ...(hasCancel
        ? [{ value: "CANCELAR", title: "❌ Cancelar" }]
        : []),
    ]);
  }
  if (/\*ENVIAR\*[\s\S]{0,80}\*PUBLICAR\*/i.test(text)) {
    return controls([
      { value: "ENVIAR", title: "📥 Só enviar" },
      { value: "PUBLICAR", title: "📤 Publicar" },
      ...(hasCancel
        ? [{ value: "CANCELAR", title: "❌ Cancelar" }]
        : []),
    ]);
  }
  if (/\*APROVAR\*/i.test(text)) {
    return controls([
      { value: "APROVAR", title: "✅ Aprovar" },
      ...(hasCancel
        ? [{ value: "CANCELAR", title: "❌ Cancelar" }]
        : []),
    ]);
  }
  if (/\*APROVADO\*/i.test(text)) {
    return controls([{ value: "APROVADO", title: "✅ Aprovado" }]);
  }
  if (/\*SIM\*/i.test(text) && /\bresponda\b/i.test(text)) {
    return controls([{ value: "SIM", title: "Sim" }]);
  }
  if (/\*Sem trilha\*/i.test(text) && /\bresponda\b/i.test(text)) {
    return controls([{ value: "Sem trilha", title: "Sem trilha" }]);
  }
  if (hasCancel && /\bresponda\b/i.test(text)) {
    return controls([{ value: "CANCELAR", title: "❌ Cancelar" }]);
  }
  return null;
}
