import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyOwnerMediaIntent,
  extractSocialPostBriefing,
  hasDirectedImageEditRequest,
  hasImageGenerationRequest,
  hasSocialPostRequest,
  selectLatestImplicitMediaId,
  selectPublicationMediaId,
} from "./owner-media-intent.ts";

const GENERATE_THEN_POST =
  "Gera uma imagem para um post da AMZ Ofertas: um empreendedor sorrindo segurando o celular [...] Depois cria o post com essa imagem para o Facebook e o Instagram, no feed, falando que com a AMZ ele cria e publica os posts da empresa só mandando uma foto no WhatsApp.";
const POST_LAST_IMAGE =
  "Posta essa no Facebook e Instagram, no feed, falando que com a AMZ o empreendedor cria e publica os posts da empresa só mandando uma foto no WhatsApp.";

Deno.test("pedido exato de produção gera a imagem antes de montar o post", () => {
  assertEquals(hasImageGenerationRequest(GENERATE_THEN_POST), true);
  assertEquals(classifyOwnerMediaIntent(GENERATE_THEN_POST), {
    action: "generate_and_post",
    mediaStrategy: "generated",
  });
  assertEquals(
    extractSocialPostBriefing(GENERATE_THEN_POST),
    "com a AMZ ele cria e publica os posts da empresa só mandando uma foto no WhatsApp.",
  );
});

Deno.test("pedido exato de post usa a última mídia e nunca vira edição", () => {
  assertEquals(hasSocialPostRequest(POST_LAST_IMAGE), true);
  assertEquals(hasDirectedImageEditRequest(POST_LAST_IMAGE), false);
  assertEquals(classifyOwnerMediaIntent(POST_LAST_IMAGE), {
    action: "post",
    mediaStrategy: "last",
  });
  assertEquals(
    extractSocialPostBriefing(POST_LAST_IMAGE),
    "com a AMZ o empreendedor cria e publica os posts da empresa só mandando uma foto no WhatsApp.",
  );
});

Deno.test("reencaminhar EA0BEE5B vence imagens geradas depois mesmo com deduplicação", () => {
  // EA0BEE5B foi salva às 08:24. Depois foram criadas 12BFB18C e
  // 40EE08A5; esta última é a linha mais nova da biblioteca.
  const newestSavedMedia = {
    id: "40EE08A5",
    created_at: "2026-09-26T11:25:30.000Z",
  };
  // Ao reencaminhar EA0BEE5B, a deduplicação conserva seu created_at antigo,
  // mas freshStatePatch registra o evento atual em last_media_interaction.
  const lastInteraction = {
    media_id: "EA0BEE5B",
    at: "2026-09-26T11:26:00.000Z",
  };
  assertEquals(
    selectLatestImplicitMediaId(newestSavedMedia, lastInteraction),
    "EA0BEE5B",
  );
});

Deno.test("foto nova da garrafa vence anúncio e carrossel antigos", () => {
  assertEquals(
    selectLatestImplicitMediaId(
      {
        id: "CITROEN-CARROSSEL",
        created_at: "2026-10-07T12:00:00.000Z",
      },
      {
        media_id: "GARRAFA-NOVA",
        at: "2026-10-07T12:15:00.000Z",
      },
    ),
    "GARRAFA-NOVA",
  );
  assertEquals(
    selectPublicationMediaId({
      lastInteraction: {
        media_id: "GARRAFA-NOVA",
        at: "2026-10-07T12:15:00.000Z",
      },
      recentGenerated: {
        id: "CITROEN-CARROSSEL",
        created_at: "2026-10-07T12:00:00.000Z",
      },
      nowMs: Date.parse("2026-10-07T12:16:00.000Z"),
    }),
    "GARRAFA-NOVA",
  );
});

Deno.test("linha nova vence quando a interação registrada é mais antiga", () => {
  assertEquals(
    selectLatestImplicitMediaId(
      { id: "40EE08A5", created_at: "2026-09-26T11:25:30.000Z" },
      { media_id: "EA0BEE5B", at: "2026-09-26T11:24:30.000Z" },
    ),
    "40EE08A5",
  );
});

Deno.test("código explícito sempre vence a seleção implícita", () => {
  assertEquals(
    selectPublicationMediaId({
      explicitId: "CODIGO",
      lastInteraction: {
        media_id: "INTERACAO",
        at: "2026-10-01T14:00:00.000Z",
      },
      recentGenerated: {
        id: "VIDEO-RECENTE",
        created_at: "2026-10-01T14:06:00.000Z",
      },
      nowMs: Date.parse("2026-10-01T14:10:00.000Z"),
    }),
    "CODIGO",
  );
});

Deno.test("interação de ontem perde para vídeo gerado hoje", () => {
  assertEquals(
    selectPublicationMediaId({
      lastInteraction: {
        media_id: "1bff2265",
        at: "2026-09-30T11:38:00.000Z",
        media_created_at: "2026-09-30T11:38:00.000Z",
      },
      recentGenerated: {
        id: "281f39c0",
        created_at: "2026-10-01T14:06:00.000Z",
      },
      nowMs: Date.parse("2026-10-01T14:10:00.000Z"),
    }),
    "281f39c0",
  );
});

Deno.test("interação de dez minutos vence geração de duas horas", () => {
  assertEquals(
    selectPublicationMediaId({
      lastInteraction: {
        media_id: "VIDEO-INTERAGIDO",
        at: "2026-10-01T14:00:00.000Z",
        media_created_at: "2026-09-20T10:00:00.000Z",
      },
      recentGenerated: {
        id: "VIDEO-GERADO",
        created_at: "2026-10-01T12:10:00.000Z",
      },
      nowMs: Date.parse("2026-10-01T14:10:00.000Z"),
    }),
    "VIDEO-INTERAGIDO",
  );
});

Deno.test("interação com mais de 24 horas é ignorada", () => {
  assertEquals(
    selectPublicationMediaId({
      lastInteraction: {
        media_id: "VIDEO-ANTIGO",
        at: "2026-09-30T14:09:59.000Z",
      },
      nowMs: Date.parse("2026-10-01T14:10:00.000Z"),
    }),
    null,
  );
});

Deno.test("publicação não usa geração com mais de duas horas", () => {
  assertEquals(
    selectPublicationMediaId({
      recentGenerated: {
        id: "VIDEO-ANTIGO",
        created_at: "2026-10-01T12:09:59.000Z",
      },
      nowMs: Date.parse("2026-10-01T14:10:00.000Z"),
    }),
    null,
  );
});

Deno.test("mantém comandos explícitos de edição dirigidos à foto", () => {
  for (
    const text of [
      "melhora essa foto",
      "troca o fundo dessa imagem",
      "coloca minha logo nessa foto",
      "coloca num estúdio",
    ]
  ) {
    assertEquals(classifyOwnerMediaIntent(text), {
      action: "edit",
      mediaStrategy: "last",
    });
  }
});

Deno.test("mantém comandos explícitos de publicação", () => {
  for (
    const text of [
      "posta essa no insta",
      "publica no facebook",
      "posta no LinkedIn",
      "publica no lkd",
    ]
  ) {
    assertEquals(classifyOwnerMediaIntent(text), {
      action: "post",
      mediaStrategy: "last",
    });
  }
});

Deno.test("não trata oração descritiva como comando de post", () => {
  assertEquals(
    classifyOwnerMediaIntent(
      "A AMZ ajuda porque ele cria e publica os posts da empresa.",
    ),
    { action: null, mediaStrategy: null },
  );
});
