import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatVideoPublishMessage } from "./video-publish-message.ts";

Deno.test("confirmação de vídeo recupera visual anterior e mantém links", () => {
  const message = formatVideoPublishMessage({
    published: ["facebook", "instagram"],
    links: [
      {
        plataforma: "facebook",
        url: "https://www.facebook.com/reel/123",
      },
      {
        plataforma: "instagram",
        url: "https://www.instagram.com/reel/456",
      },
    ],
  });

  assertStringIncludes(message, "POSTAGEM REALIZADA COM SUCESSO");
  assertStringIncludes(message, "✅ *FACEBOOK*");
  assertStringIncludes(message, "https://www.facebook.com/reel/123");
  assertStringIncludes(message, "✅ *INSTAGRAM*");
  assertStringIncludes(message, "https://www.instagram.com/reel/456");
});

Deno.test("falha de uma rede aparece uma vez com motivo curto", () => {
  const message = formatVideoPublishMessage({
    published: ["facebook"],
    links: [{
      plataforma: "facebook",
      url: "https://www.facebook.com/reel/123",
    }],
    errors: ["Instagram: não consegui publicar o vídeo. Tente novamente."],
  });

  assertStringIncludes(
    message,
    "❌ *INSTAGRAM* — não consegui publicar o vídeo. Tente novamente.",
  );
  assertEquals(message.match(/❌ \*INSTAGRAM\*/g)?.length, 1);
});
