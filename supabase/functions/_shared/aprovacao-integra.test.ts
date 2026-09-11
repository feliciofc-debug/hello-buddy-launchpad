import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pareceResumoDeOpcoes, segmentoIntruso, segmentosNoTexto } from "./aprovacao-integra.ts";

Deno.test("pega o resumo que o Jarvis mandou no lugar dos textos", () => {
  const ruim = `Aqui estão os resumos das 3 opções pra você escolher, chefe:

*Opção A (Direta):* Foco na praticidade — mostra como a AMZ Ofertas assume o atendimento.
*Opção B (História):* Cenário real — o paciente na cadeira.
*Opção C (Interativa):* Provocação — "Você é dentista ou recepcionista?"`;
  assertEquals(pareceResumoDeOpcoes(ruim) !== null, true);
});

Deno.test("aceita as três copies completas", () => {
  const bom = `*Opção A — Direta*
🚀 Sua empresa atendendo 24h no WhatsApp, sem contratar ninguém.
• Resposta imediata • Publicação automática
👉 Chama no direct pra testar!
#AMZOfertas #IA #WhatsApp #Automacao #Marketing

*Opção B — História*
📱 Era 22h e a mensagem do cliente ficou sem resposta. Nunca mais.
A IA da AMZ Ofertas responde na hora e ainda publica seu conteúdo.
👉 Chama no direct!
#AMZOfertas #IA #Vendas #WhatsApp #Automacao

*Opção C — Interativa*
🤔 Quantos clientes você perdeu por demorar pra responder?
A AMZ Ofertas cuida do atendimento e da publicação por você.
👉 Comenta EU QUERO!
#AMZOfertas #IA #Atendimento #WhatsApp #Marketing`;
  assertEquals(pareceResumoDeOpcoes(bom), null);
});

Deno.test("texto sem opções não é resumo", () => {
  assertEquals(pareceResumoDeOpcoes("Publiquei no Instagram e no Facebook."), null);
});

Deno.test("detecta segmento de outro cliente na copy", () => {
  const pedido = "Vídeo institucional da AMZ Ofertas — inteligência artificial no WhatsApp";
  const copy = "O paciente na cadeira e o telefone do consultório apitando. Dentista, isso acaba hoje.";
  assertEquals(segmentoIntruso(pedido, copy), "odontologia");
});

Deno.test("segmento pedido pelo dono é permitido", () => {
  const pedido = "Post pro consultório odontológico do cliente, foco em clareamento";
  const copy = "Dentista, seu paciente merece um clareamento seguro.";
  assertEquals(segmentoIntruso(pedido, copy), null);
  assertEquals(segmentosNoTexto(pedido).includes("odontologia"), true);
});
