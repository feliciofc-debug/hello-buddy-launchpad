import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isLikelyBusinessAutoReply } from "./whatsapp-opt-in-gate.ts";

const invitationSentAt = "2026-10-01T14:00:00.000Z";

Deno.test("ignora saudação automática logo após o convite", () => {
  assertEquals(
    isLikelyBusinessAutoReply({
      text:
        "Olá! Seja bem-vindo. Obrigado por entrar em contato. Em breve retornaremos.",
      invitationSentAt,
      receivedAt: "2026-10-01T14:00:05.000Z",
    }),
    true,
  );
});

Deno.test("ignora menu automático e pergunta comercial logo após o convite", () => {
  assertEquals(
    isLikelyBusinessAutoReply({
      text:
        "Qual produto você procura? Digite 1 para doces ou 2 para salgados.",
      invitationSentAt,
      receivedAt: "2026-10-01T14:00:08.000Z",
    }),
    true,
  );
});

Deno.test("botão explícito de aceite nunca é classificado como auto-resposta", () => {
  assertEquals(
    isLikelyBusinessAutoReply({
      text: "Sim, quero!",
      buttonId: "OPTIN_SIM",
      invitationSentAt,
      receivedAt: "2026-10-01T14:00:05.000Z",
    }),
    false,
  );
});

Deno.test("resposta humana fora da janela curta segue para a regra normal", () => {
  assertEquals(
    isLikelyBusinessAutoReply({
      text: "sim",
      invitationSentAt,
      receivedAt: "2026-10-01T14:10:00.000Z",
    }),
    false,
  );
});
