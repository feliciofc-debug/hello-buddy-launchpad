import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendWhatsappCtaInPublishingOrder } from "./social-caption-order.ts";

Deno.test("legenda mantém chamada, benefícios, CTA, link e hashtags nessa ordem", () => {
  const caption = appendWhatsappCtaInPublishingOrder(
    "Conheça a novidade.\n\nMais praticidade no dia a dia.\n\n#oferta #novidade",
    "5592999999999",
  );
  assertEquals(caption.startsWith("http"), false);
  const call = caption.indexOf("Conheça a novidade");
  const benefit = caption.indexOf("Mais praticidade");
  const cta = caption.indexOf("Chame no WhatsApp");
  const link = caption.indexOf("https://wa.me/");
  const tags = caption.indexOf("#oferta");
  assert(call < benefit && benefit < cta && cta < link && link < tags);
});

Deno.test("CTA antigo em sanduíche é removovido sem duplicar link", () => {
  const caption = appendWhatsappCtaInPublishingOrder(
    "📱 Fale comigo no WhatsApp: wa.me/5511111111111\n\nOferta real.\n\n#oferta\n\n📱 Fale comigo no WhatsApp: wa.me/5511111111111",
    "5522222222222",
  );
  assertEquals((caption.match(/wa\.me\//g) ?? []).length, 1);
  assert(caption.endsWith("#oferta"));
});
