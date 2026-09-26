import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildProspectDemoCarouselPrompt } from "./business-context.ts";
import {
  carouselBodyLines,
  requestedCarouselSlideCount,
  sanitizeCarouselSlides,
  sanitizeProspectDemoCaption,
  sanitizeProspectDemoSlides,
  sendCarouselCardsInOrder,
} from "./carousel-content.ts";

Deno.test("texto de slide troca marcador emoji por bullet e remove os demais emojis", () => {
  const [slide] = sanitizeCarouselSlides([{
    title: "🛋️ Conforto de verdade",
    body: "✅ Mais espaço\n✨ Ideal para descansar\nDesign moderno 🎯",
  }]);
  const rendered = JSON.stringify(slide);
  assertEquals(slide.title, "Conforto de verdade");
  assertEquals(slide.body, "• Mais espaço\n• Ideal para descansar\nDesign moderno");
  assert(!rendered.includes("▒"));
  assert(!/\p{Extended_Pictographic}/u.test(rendered));
});

Deno.test("tópicos com quebra real ou escapada permanecem em linhas separadas", () => {
  assertEquals(
    carouselBodyLines("Primeiro tópico\\nSegundo tópico\nTerceiro tópico"),
    ["Primeiro tópico", "Segundo tópico", "Terceiro tópico"],
  );
});

Deno.test("quantidade pedida é respeitada e demonstração fica limitada a cinco", () => {
  assertEquals(requestedCarouselSlideCount("carrossel de 4 cards sobre sofá"), 4);
  assertEquals(requestedCarouselSlideCount("quero 6 páginas", true), 5);
  assertEquals(requestedCarouselSlideCount("carrossel sobre decoração"), 7);
});

Deno.test("prompt de demonstração usa produto e ramo do prospect sem marca AMZ", () => {
  const prompt = buildProspectDemoCarouselPrompt({
    tema: "benefícios de um sofá retrátil",
    ramo: "loja de móveis",
    numSlides: 4,
  });
  assert(prompt.includes("benefícios de um sofá retrátil"));
  assert(prompt.includes("loja de móveis"));
  assert(prompt.includes("NÚMERO EXATO DE SLIDES: 4"));
  assert(!/\bAMZ\b/i.test(prompt));
  assert(!/wa\.me/i.test(prompt));
});

Deno.test("demonstração remove marca e contato da arte e da legenda", () => {
  const [slide] = sanitizeProspectDemoSlides([{
    title: "AMZ Ofertas apresenta",
    body: "Veja mais em https://amz.example\nFale no +55 21 99999-0000",
  }]);
  const caption = sanitizeProspectDemoCaption(
    "Conheça na AMZ Ofertas: https://wa.me/5521999990000 @amzofertas",
    "sofá retrátil",
  );
  assert(!/AMZ|https?:|wa\.me|@amz|\+55/i.test(JSON.stringify(slide)));
  assert(!/AMZ|https?:|wa\.me|@amz/i.test(caption));
});

Deno.test("todos os cards são enviados em ordem e falha recebe uma tentativa extra", async () => {
  const attempts: number[] = [];
  const delivered: number[] = [];
  let failedSecondCard = false;
  const sent = await sendCarouselCardsInOrder({
    imageUrls: ["1.png", "2.png", "3.png", "4.png"],
    send: async (_url, index) => {
      attempts.push(index);
      if (index === 1 && !failedSecondCard) {
        failedSecondCard = true;
        throw new Error("falha transitória");
      }
      delivered.push(index);
    },
  });
  assertEquals(sent, 4);
  assertEquals(attempts, [0, 1, 1, 2, 3]);
  assertEquals(delivered, [0, 1, 2, 3]);
});
