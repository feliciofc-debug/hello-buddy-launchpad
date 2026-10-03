import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  betweenPartsDelayForSenderMs,
  firstReplyDelayForSenderMs,
  hasNewerProcessableInbound,
  prepareLeadReplyParts,
  virtualAssistantDisclosure,
} from "./whatsapp-humanized-delivery.ts";

Deno.test("pergunta sobre robô recebe identificação virtual honesta e whitelabel", () => {
  const answer = virtualAssistantDisclosure("Loja Exemplo");
  assertEquals(
    answer,
    "Sou o assistente virtual da Loja Exemplo. Se preferir, posso chamar alguém da equipe.",
  );
  assertEquals(/AMZ|OpenAI|Gemini|ChatGPT|tecnologia/i.test(answer), false);
});

Deno.test("resposta longa de lead vira no máximo três partes abaixo de 700 caracteres", () => {
  const sentence = "Esta é uma frase completa para explicar o atendimento com clareza. ";
  const parts = prepareLeadReplyParts(sentence.repeat(40));
  assert(parts.length <= 3);
  assert(parts.length > 1);
  assert(parts.every((part) => part.length <= 700));
  assert(parts.slice(0, -1).every((part) => /[.!?]$/.test(part)));
});

Deno.test("três mensagens seguidas deixam apenas a mais recente responder", () => {
  const messages = [
    { created_at: "2026-09-26T14:00:00Z", status: "processing" },
    { created_at: "2026-09-26T14:00:02Z", status: "processing" },
    { created_at: "2026-09-26T14:00:04Z", status: "received" },
  ];
  assertEquals(hasNewerProcessableInbound(messages[0].created_at, messages.slice(1)), true);
  assertEquals(hasNewerProcessableInbound(messages[1].created_at, messages.slice(2)), true);
  assertEquals(hasNewerProcessableInbound(messages[2].created_at, []), false);
});

Deno.test("dono não recebe espera artificial", () => {
  const receivedAt = "2026-09-26T14:00:00Z";
  const now = new Date("2026-09-26T14:00:01Z");
  assertEquals(firstReplyDelayForSenderMs(true, receivedAt, 300, now), 0);
  assertEquals(betweenPartsDelayForSenderMs(true, 300), 0);
  assert(firstReplyDelayForSenderMs(false, receivedAt, 300, now) > 0);
});
