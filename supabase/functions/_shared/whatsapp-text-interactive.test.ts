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
  });
  assertEquals(payloads.length, 2);
  assertEquals(payloads[0].type, "text");
  assertStringIncludes(
    String((payloads[0].text as { body: string }).body),
    "POSTAGEM REALIZADA",
  );
  assertEquals(payloads[1].type, "interactive");
});

Deno.test("lista sem mensagem continua em um único envio", () => {
  const interactivePayload = {
    messaging_product: "whatsapp",
    type: "interactive",
  };
  assertEquals(
    textThenInteractivePayloads({
      to: "5521999999999",
      interactivePayload,
    }),
    [interactivePayload],
  );
});
