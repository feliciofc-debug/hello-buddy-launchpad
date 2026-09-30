import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AMZ_KNOWLEDGE,
  AMZ_SALES_BLOCK,
  AMZ_SUPPORT_BLOCK,
} from "./agent-soul.ts";
import { dedupeConsecutiveReplyText } from "./reply-dedupe.ts";
import { extractWhatsAppBrandSiteUrl } from "./whatsapp-image-brand.ts";
import {
  containsUnsupportedCreativeClaim,
  decideWhatsAppCreativeTool,
  deterministicDemoBlockedResponse,
  demoLimitMessage,
  demoLimitReplay,
  DEMO_LIMIT_MESSAGE,
  finalizeAmzNonOwnerText,
  isDemoTestPhone,
  guardProspectCreativeClaims,
  NON_OWNER_CAPABILITY_GUIDANCE,
  nonOwnerCapabilityGuidance,
  ownerForwardClientConfirmation,
  requiredProspectCreativeTool,
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

Deno.test("bloqueio criativo preserva exatamente mensagem e mídia de replay", () => {
  const message =
    "A demonstração gratuita deste número foi feita em 20/09/2026. Vou reenviar a última mídia.";
  const response = deterministicDemoBlockedResponse(
    "gerar_imagem",
    JSON.stringify({
      status: "demonstracao_bloqueada",
      mensagem: message,
    }),
    "https://cdn.example/demo.png",
  );
  assertEquals(response, {
    text: message,
    imageUrl: "https://cdn.example/demo.png",
  });
  assertEquals(response?.text.includes("logo"), false);
});

Deno.test("resultado comum e tool não criativa continuam no fluxo normal", () => {
  const blocked = JSON.stringify({
    status: "demonstracao_bloqueada",
    mensagem: "Mensagem literal",
  });
  assertEquals(deterministicDemoBlockedResponse("consultar_clima", blocked), null);
  assertEquals(deterministicDemoBlockedResponse(
    "gerar_imagem",
    JSON.stringify({ ok: true }),
  ), null);
});

Deno.test("quatro respostas reais falsas viram limite determinístico", () => {
  const falseReplies = [
    "A demonstração gratuita é de 1 post por empresa e já criei a sua logo acima!",
    "A demonstração gratuita de 1 post com seu site já foi gerada na mensagem anterior!",
    "A imagem de demonstração da Loja Bom Pastor já está logo acima no chat! Como cada conta tem direito a 1 teste de imagem",
    "A demonstração com a Loja Bom Pastor já foi gerada ali em cima na conversa! Como o limite de teste é de 1 post, o recado já foi entregue ao Felicio",
  ];
  for (const falseReply of falseReplies) {
    assertEquals(containsUnsupportedCreativeClaim(falseReply), true);
    const guarded = guardProspectCreativeClaims({
      text: falseReply,
      isAmzProspect: true,
      creativeToolRan: false,
      previousDemoCreatedAt: "2026-09-29T15:00:00.000Z",
    });
    assertEquals(
      guarded.includes("A demonstração gratuita deste número foi feita em 29/09/2026."),
      true,
    );
    assertEquals(/\bfel[ií]cio\b/i.test(guarded), false);
    assertEquals(guarded.includes("por empresa"), false);
    assertEquals(guarded.trim().length > 0, true);
  }
});

Deno.test("pedido repetido de telefone de teste exige tool criativa", () => {
  assertEquals(
    requiredProspectCreativeTool("gera de novo com a logo do site"),
    "gerar_imagem",
  );
  assertEquals(
    requiredProspectCreativeTool("cria um carrossel de 5 cards"),
    "criar_carrossel",
  );
  assertEquals(requiredProspectCreativeTool("qual o preço do plano?"), null);
});

Deno.test("frase real de demonstração exige imagem e preserva site_url", () => {
  const text =
    "quero ver a demonstração com o meu site lojabompastor.com.br";
  const siteUrl = extractWhatsAppBrandSiteUrl(text);
  assertEquals(siteUrl, "https://lojabompastor.com.br/");
  assertEquals(
    requiredProspectCreativeTool(text, Boolean(siteUrl)),
    "gerar_imagem",
  );
  assertEquals(
    requiredProspectCreativeTool("vocês conseguem fazer foto?"),
    null,
  );
  assertEquals(requiredProspectCreativeTool("como funciona?"), null);
  assertEquals(requiredProspectCreativeTool("quanto custa?"), null);
});

Deno.test("filtro final anonimiza nome do dono mesmo após tool criativa", () => {
  assertEquals(guardProspectCreativeClaims({
    text: "O recado já foi entregue ao Felício.",
    isAmzProspect: true,
    creativeToolRan: true,
  }), "O recado já foi entregue a um consultor da AMZ.");
  assertEquals(guardProspectCreativeClaims({
    text: "O Felicio vai retornar; fale pro Felicio se precisar.",
    isAmzProspect: true,
    creativeToolRan: false,
  }), "um consultor da AMZ vai retornar; fale para um consultor da AMZ se precisar.");
});

Deno.test("filtro final remove contato direto de toda resposta ao prospect AMZ", () => {
  const guarded = guardProspectCreativeClaims({
    text: "Prontinho! Veja como fica um post para a Loja Bom Pastor: https://wa.me/5521980804901 O conforto que sua casa merece...",
    isAmzProspect: true,
    creativeToolRan: true,
  });
  assertEquals(
    guarded,
    "Prontinho! Veja como fica um post para a Loja Bom Pastor: O conforto que sua casa merece...",
  );
  assertEquals(guardProspectCreativeClaims({
    text: "Fale pelo api.whatsapp.com/send?phone=5521980804901 ou +55 (21) 98080-4901.",
    isAmzProspect: true,
    creativeToolRan: false,
  }), "Fale pelo ou.");
  assertEquals(guardProspectCreativeClaims({
    text: "https://chat.whatsapp.com/convite",
    isAmzProspect: true,
    creativeToolRan: false,
  }), "Posso te ajudar com mais alguma dúvida sobre a plataforma?");
});

Deno.test("encaminhamento direto anonimiza somente o tenant AMZ", () => {
  assertEquals(ownerForwardClientConfirmation({
    isAmzTenant: true,
    humanNeeded: false,
    explicitForward: true,
    ownerName: "Felicio Carega",
    protocol: "(protocolo #DVENQA · 07:33)",
  }), "Certo, já encaminhei para um dos nossos consultores. Ele vai entrar em contato com você. (protocolo #DVENQA · 07:33)");
  assertEquals(ownerForwardClientConfirmation({
    isAmzTenant: true,
    humanNeeded: true,
    explicitForward: false,
    ownerName: "Felicio Carega",
    protocol: "(protocolo #ABC123 · 10:30)",
  }), "Vou confirmar isso com um dos nossos consultores e pedir para ele te retornar. (protocolo #ABC123 · 10:30)");
  assertEquals(ownerForwardClientConfirmation({
    isAmzTenant: false,
    humanNeeded: false,
    explicitForward: true,
    ownerName: "Marcelo Silva",
    protocol: "(protocolo #ABC123 · 10:30)",
  }), "Certo, já encaminhei para Marcelo. (protocolo #ABC123 · 10:30)");
});

Deno.test("rede final de não-dono AMZ remove nome configurado e Felicio", () => {
  assertEquals(
    finalizeAmzNonOwnerText(
      "O Felicio falou com Marcelo Silva. Vou confirmar com o Marcelo.",
      "Marcelo Silva",
    ),
    "um consultor da AMZ falou com um consultor da AMZ. Vou confirmar com um consultor da AMZ.",
  );
  assertEquals(/\bfel[ií]cio\b/i.test(
    finalizeAmzNonOwnerText("Já encaminhei ao Felício."),
  ), false);
});

Deno.test("atalho restrito de não-dono segue ao modelo com orientação", () => {
  assertEquals(
    nonOwnerCapabilityGuidance(
      false,
      true,
    ),
    NON_OWNER_CAPABILITY_GUIDANCE,
  );
  assertEquals(nonOwnerCapabilityGuidance(false, false), null);
  assertEquals(nonOwnerCapabilityGuidance(true, true), null);
  assertEquals(
    NON_OWNER_CAPABILITY_GUIDANCE.includes("Não execute publicação, vídeo ou composição"),
    true,
  );
  assertEquals(NON_OWNER_CAPABILITY_GUIDANCE.includes(DEMO_LIMIT_MESSAGE), false);
});

Deno.test("conversa normal e resposta ao dono ficam inalteradas", () => {
  const normal = "Posso te explicar como a plataforma funciona. Qual é o seu negócio?";
  assertEquals(guardProspectCreativeClaims({
    text: normal,
    isAmzProspect: true,
    creativeToolRan: false,
  }), normal);

  const ownerText = "Já criei a sua imagem e salvei na biblioteca.";
  assertEquals(guardProspectCreativeClaims({
    text: ownerText,
    isAmzProspect: false,
    creativeToolRan: false,
  }), ownerText);
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
    "um consultor da AMZ vai entrar em contato",
    "SEMPRE chame a ferramenta correspondente",
    "Só afirme após receber o resultado da ferramenta",
    "Nunca cite o nome do dono para prospect",
  ]) {
    assertEquals(prompt.includes(trecho), true);
  }
});

Deno.test("prompts e limite para prospect não expõem nome do dono", () => {
  const prospectText = [
    AMZ_KNOWLEDGE,
    AMZ_SALES_BLOCK,
    AMZ_SUPPORT_BLOCK,
    DEMO_LIMIT_MESSAGE,
    demoLimitMessage("2026-09-29T15:00:00.000Z"),
  ].join("\n");
  assertEquals(/\bfel[ií]cio\b/i.test(prospectText), false);
  assertEquals(prospectText.includes("um consultor da AMZ"), true);
});
