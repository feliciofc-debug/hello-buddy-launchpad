import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyOwnerMediaIntent,
  extractSocialPostBriefing,
  hasDirectedImageEditRequest,
  hasImageGenerationRequest,
  hasSocialPostRequest,
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
  const latestConversationMediaId = "EA0BEE5B";
  const selectedMediaId =
    classifyOwnerMediaIntent(POST_LAST_IMAGE).mediaStrategy === "last"
      ? latestConversationMediaId
      : "12BFB18C";
  assertEquals(selectedMediaId, "EA0BEE5B");
  assertEquals(
    extractSocialPostBriefing(POST_LAST_IMAGE),
    "com a AMZ o empreendedor cria e publica os posts da empresa só mandando uma foto no WhatsApp.",
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
  for (const text of ["posta essa no insta", "publica no facebook"]) {
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
