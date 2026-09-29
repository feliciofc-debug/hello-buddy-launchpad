import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AMZ_KNOWLEDGE, AMZ_SALES_BLOCK } from "./agent-soul.ts";
import { dedupeConsecutiveReplyText } from "./reply-dedupe.ts";
import {
  decideWhatsAppCreativeTool,
  demoLimitMessage,
  demoLimitReplay,
  DEMO_LIMIT_MESSAGE,
  isDemoTestPhone,
} from "./whatsapp-demo-policy.ts";

Deno.test("prospect AMZ gera uma imagem e a segunda é recusada", () => {
  assertEquals(decideWhatsAppCreativeTool({
    toolName: "gerar_imagem",
    isOwner: false,
    isAmzTenant: true,
    generatedImages: 0,
  }), { allowed: true, mode: "demo" });
  assertEquals(decideWhatsAppCreativeTool({
    toolName: "gerar_imagem",
    isOwner: false,
    isAmzTenant: true,
    generatedImages: 1,
  }), { allowed: false, reason: "demo_limit", message: DEMO_LIMIT_MESSAGE });
});

Deno.test("prospect AMZ gera um carrossel e o segundo é recusado", () => {
  assertEquals(decideWhatsAppCreativeTool({
    toolName: "criar_carrossel",
    isOwner: false,
    isAmzTenant: true,
    generatedCarousels: 0,
  }), { allowed: true, mode: "demo" });
  assertEquals(decideWhatsAppCreativeTool({
    toolName: "criar_carrossel",
    isOwner: false,
    isAmzTenant: true,
    generatedCarousels: 1,
  }), { allowed: false, reason: "demo_limit", message: DEMO_LIMIT_MESSAGE });
});

Deno.test("prospect AMZ não publica nem usa ferramentas fora da demonstração", () => {
  for (const toolName of ["postar_redes_sociais", "confirmar_postagem_redes", "editar_imagem", "criar_video_animado"]) {
    assertEquals(
      decideWhatsAppCreativeTool({ toolName, isOwner: false, isAmzTenant: true }).allowed,
      false,
    );
  }
});

Deno.test("cliente final de outro tenant não gera imagem", () => {
  assertEquals(
    decideWhatsAppCreativeTool({
      toolName: "gerar_imagem",
      isOwner: false,
      isAmzTenant: false,
    }).allowed,
    false,
  );
});

Deno.test("dono mantém acesso às ferramentas sem limite de demonstração", () => {
  assertEquals(decideWhatsAppCreativeTool({
    toolName: "gerar_imagem",
    isOwner: true,
    isAmzTenant: true,
    generatedImages: 99,
  }), { allowed: true, mode: "owner" });
});

Deno.test("telefone de teste AMZ ignora limite sem virar dono", () => {
  assertEquals(
    isDemoTestPhone("5521988887777", ["(21) 98888-7777"]),
    true,
  );
  assertEquals(
    isDemoTestPhone("552188887777", ["5521988887777"]),
    true,
  );
  assertEquals(
    decideWhatsAppCreativeTool({
      toolName: "gerar_imagem",
      isOwner: false,
      isAmzTenant: true,
      generatedImages: 0,
    }),
    { allowed: true, mode: "demo" },
  );
});

Deno.test("limite informa data sem afirmar que a demo foi feita agora", () => {
  const message = demoLimitMessage("2026-09-20T15:00:00.000Z");
  assertEquals(message.includes("20/09/2026"), true);
  assertEquals(message.includes("Essa foi"), false);
  assertEquals(message.includes("reenviar a última mídia"), true);
  assertEquals(demoLimitReplay({
    created_at: "2026-09-20T15:00:00.000Z",
    midia_url: "https://cdn.example/demo.png",
  }).imageUrl, "https://cdn.example/demo.png");
});

Deno.test("reply duplicado consecutivo vira texto único inclusive entre partes", () => {
  const paragraph = "A plataforma cria o conteúdo. Você escolhe quando publicar.";
  assertEquals(dedupeConsecutiveReplyText(`${paragraph} ${paragraph}`), paragraph);
  assertEquals(dedupeConsecutiveReplyText(`${paragraph} ${paragraph} ${paragraph}`), paragraph);
  assertEquals(dedupeConsecutiveReplyText(`${paragraph}<<SPLIT>>${paragraph}`), paragraph);
  assertEquals(dedupeConsecutiveReplyText(`${paragraph}\n\n${paragraph}`), paragraph);
});

Deno.test("reply sem repetição conserva formatação", () => {
  const reply = "Primeira linha.\nSegunda linha com https://amzofertas.com.br/demo.";
  assertEquals(dedupeConsecutiveReplyText(reply), reply);
});

Deno.test("Pietro conduz imagem e carrossel com uma pergunta por vez", () => {
  const prompt = `${AMZ_KNOWLEDGE} ${AMZ_SALES_BLOCK}`.replace(/\s+/g, " ");
  for (const trecho of [
    "Me diz um produto ou serviço seu",
    "chame gerar_imagem",
    "Quer ver também um carrossel pro Instagram?",
    "chame criar_carrossel",
    "ofereça a mesma demonstração novamente",
    "2 ou 3 melhorias concretas",
    "passe-o em site_url",
    "sem salvar no cadastro",
    "Prospect nunca publica",
    "Quando pedir preço ou proposta",
    "chame registrar_lead_novo",
    "Felicio vai entrar em contato",
  ]) {
    assertEquals(prompt.includes(trecho), true);
  }
});
