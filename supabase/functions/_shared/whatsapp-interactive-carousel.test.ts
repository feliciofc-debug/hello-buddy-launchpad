import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildInteractiveCarouselPayload,
  buildInteractiveImageHeaderButtonPayload,
  sanitizeCarouselCardBody,
} from "./whatsapp-interactive-carousel.ts";

const sampleCard = (index: number) => ({
  card_index: index,
  imageUrl: "https://example.com/a.jpg",
  body: "Honda Civic\n2020 · R$ 90.000",
  buttons: [
    { id: "veiculo_vitrine:detalhe:1", title: "Ver detalhes" },
    { id: "veiculo_vitrine:interesse:1", title: "Tenho interesse" },
  ],
});

Deno.test("carrossel Meta: cards cta_url e botões quick_reply", () => {
  const payload = buildInteractiveCarouselPayload({
    to: "5521999999999",
    body: "Carros disponíveis",
    cards: [sampleCard(0), sampleCard(1)],
  });
  const json = JSON.stringify(payload);
  assertStringIncludes(json, '"type":"cta_url"');
  assertStringIncludes(json, '"type":"quick_reply"');
  assertStringIncludes(json, '"quick_reply"');
  assertEquals(
    (payload.interactive as { action: { cards: unknown[] } }).action.cards.length,
    2,
  );
  const card = (payload.interactive as { action: { cards: Record<string, unknown>[] } })
    .action.cards[0];
  assertEquals(card.type, "cta_url");
  const btn = (card.action as { buttons: Record<string, unknown>[] }).buttons[0];
  assertEquals(btn.type, "quick_reply");
});

Deno.test("carrossel exige entre 2 e 10 cards", () => {
  assertThrows(
    () =>
      buildInteractiveCarouselPayload({
        to: "5521",
        body: "x",
        cards: [sampleCard(0)],
      }),
    Error,
    "carousel_requires_min_2_cards",
  );
});

Deno.test("corpo do card limita quebras de linha", () => {
  const body = sanitizeCarouselCardBody("a\nb\nc\nd\ne");
  assertEquals(body.split("\n").length, 3);
});

Deno.test("fallback usa header imagem no mesmo balão button", () => {
  const payload = buildInteractiveImageHeaderButtonPayload({
    to: "5521999999999",
    body: "Detalhes",
    imageUrl: "https://example.com/car.jpg",
    buttons: [
      { id: "veiculo_vitrine:fotos:1", title: "Fotos" },
      { id: "veiculo_vitrine:detalhe:1", title: "Detalhes" },
      { id: "veiculo_vitrine:interesse:1", title: "Tenho interesse" },
    ],
  });
  const interactive = payload.interactive as Record<string, unknown>;
  assertEquals(interactive.type, "button");
  const header = interactive.header as { type: string; image: { link: string } };
  assertEquals(header.type, "image");
  assertStringIncludes(header.image.link, "example.com");
});
