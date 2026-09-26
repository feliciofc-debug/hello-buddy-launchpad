import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dedupeConsecutiveReplyText } from "./reply-dedupe.ts";
import {
  decideWhatsAppCreativeTool,
  DEMO_LIMIT_MESSAGE,
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
