import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  asksForLeadName,
  extractLeadName,
  findLeadNameInConversation,
} from "./lead-name.ts";

Deno.test("captura Fred após pergunta de nome feita pela IA", () => {
  const messages = [
    { direction: "outbound", content: "Legal! Como posso te chamar?" },
    { direction: "inbound", content: "Fred" },
  ];
  assertEquals(asksForLeadName(messages[0].content), true);
  assertEquals(findLeadNameInConversation(messages), "Fred");
});

Deno.test("nome recuperado da conversa fica disponível para o recado ao dono", () => {
  const messages = [
    { direction: "outbound", content: "Qual é o seu nome?" },
    { direction: "inbound", content: "Fred" },
    { direction: "outbound", content: "Obrigado, Fred. Qual é o seu ramo?" },
    { direction: "inbound", content: "Trabalho com mármore e granito." },
  ];
  const nome = findLeadNameInConversation(messages);
  assertEquals(nome, "Fred");
  assertEquals(`Nome: ${nome}`, "Nome: Fred");
});

Deno.test("não trata pergunta ou frase com verbo como resposta curta de nome", () => {
  assertEquals(extractLeadName("Você pode ajudar?", true), null);
  assertEquals(extractLeadName("Trabalho com mármore", true), null);
  assertEquals(extractLeadName("Sou de Cachoeiro", false), null);
});

Deno.test("mantém captura explícita de nome", () => {
  assertEquals(extractLeadName("Meu nome é Fred Silva"), "Fred Silva");
});
