import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  replyTextControlsForMessage,
  replyTextFromInteractive,
} from "./reply-text-buttons.ts";

function assertEveryControlReturnsItsWord(message: string) {
  const controls = replyTextControlsForMessage(message);
  const options = controls?.interactiveButtons?.buttons ??
    controls?.interactiveList?.rows ??
    [];
  for (const option of options) {
    assertEquals(
      replyTextFromInteractive(`<<INTERACTIVE_ID:${option.id}>>`),
      option.id.slice("reply_text:".length),
    );
  }
  return controls;
}

Deno.test("A, B e C dos botões equivalem exatamente às respostas digitadas", () => {
  const controls = assertEveryControlReturnsItsWord(
    "Responda *A*, *B* ou *C* para escolher.",
  );
  assertEquals(
    controls?.interactiveButtons?.buttons.map((button) => button.id),
    ["reply_text:A", "reply_text:B", "reply_text:C"],
  );
});

Deno.test("ENVIAR, PUBLICAR e CANCELAR preservam as palavras do fluxo", () => {
  const controls = assertEveryControlReturnsItsWord(
    "Responda *ENVIAR* ou *PUBLICAR* — ou responda *CANCELAR*.",
  );
  assertEquals(
    controls?.interactiveButtons?.buttons.map((button) => button.id),
    ["reply_text:ENVIAR", "reply_text:PUBLICAR", "reply_text:CANCELAR"],
  );
});

Deno.test("APROVAR, APROVADO, SIM e Sem trilha preservam o texto digitado", () => {
  for (
    const [message, expected] of [
      [
        "Responda *APROVAR* para publicar, ou *CANCELAR*.",
        ["APROVAR", "CANCELAR"],
      ],
      ["Responda *APROVADO* para renderizar.", ["APROVADO"]],
      ["Responda *SIM* para retomar.", ["SIM"]],
      ["Responda *Sem trilha* para gerar sem som.", ["Sem trilha"]],
    ] as const
  ) {
    const controls = assertEveryControlReturnsItsWord(message);
    const options = controls?.interactiveButtons?.buttons ?? [];
    assertEquals(
      options.map((option) =>
        replyTextFromInteractive(`<<INTERACTIVE_ID:${option.id}>>`)
      ),
      [...expected],
    );
  }
});

Deno.test("quatro escolhas usam lista interativa", () => {
  const controls = assertEveryControlReturnsItsWord(
    "Esperando *A*, *B* ou *C*. Se for cancelar, responda *CANCELAR*.",
  );
  assertEquals(controls?.interactiveButtons, undefined);
  assertEquals(controls?.interactiveList?.rows.length, 4);
});
