import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { textThenInteractivePayloads } from "./whatsapp-text-interactive.ts";

Deno.test("confirmação completa é enviada antes da lista interativa", () => {
  const payloads = textThenInteractivePayloads({
    to: "5521999999999",
    message:
      "🎉 *POSTAGEM REALIZADA COM SUCESSO!* 🎉\n\n✅ *INSTAGRAM*\nhttps://instagram.com/p/1",
    interactivePayload: {
      messaging_product: "whatsapp",
      to: "5521999999999",
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Quer publicar também em:" },
      },
    },
    sendTextFirst: true,
  });
  assertEquals(payloads.length, 2);
  assertEquals(payloads[0].type, "text");
  assertStringIncludes(
    String((payloads[0].text as { body: string }).body),
    "POSTAGEM REALIZADA",
  );
  assertEquals(payloads[1].type, "interactive");
});

Deno.test("mensagem curta com botões continua em um único envio", () => {
  const interactivePayload = {
    messaging_product: "whatsapp",
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Opção A, B ou C?" },
    },
  };
  assertEquals(
    textThenInteractivePayloads({
      to: "5521999999999",
      message: "Opção A, B ou C?",
      interactivePayload,
    }),
    [interactivePayload],
  );
});

Deno.test("FIPE curta com lista mantém um único balão como antes", () => {
  const interactivePayload = {
    messaging_product: "whatsapp",
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Qual versão do veículo?" },
    },
  };
  assertEquals(
    textThenInteractivePayloads({
      to: "5521999999999",
      message: "Encontrei mais de uma versão. Escolha a correta:",
      interactivePayload,
    }),
    [interactivePayload],
  );
});

Deno.test("texto acima de 1024 caracteres é enviado antes dos botões", () => {
  const interactivePayload = {
    messaging_product: "whatsapp",
    type: "interactive",
  };
  const payloads = textThenInteractivePayloads({
    to: "5521999999999",
    message: "a".repeat(1025),
    interactivePayload,
  });
  assertEquals(payloads.length, 2);
  assertEquals(payloads[0].type, "text");
  assertEquals(payloads[1], interactivePayload);
});
