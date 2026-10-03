import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isExplicitTextOnlyPublication,
  isConfirmedLinkedInPublishResult,
  publicationMediaReference,
  sanitizeLinkedInApprovalCopy,
  shouldPrepareLinkedInTextOnly,
} from "./linkedin-approval.ts";
import { criarPost } from "./linkedin.ts";

Deno.test("copy do LinkedIn remove emoji e posiciona link antes de até três hashtags", () => {
  assertEquals(
    sanitizeLinkedInApprovalCopy(
      "Uma observação profissional. 🚀\n\n#Um #Dois #Tres #Quatro\nhttps://exemplo.com",
    ),
    "Uma observação profissional.\n\nhttps://exemplo.com\n\n#Um #Dois #Tres",
  );
});

Deno.test("publicação LinkedIn só confirma sucesso com URN real", () => {
  assertEquals(
    isConfirmedLinkedInPublishResult(true, { success: true, post_urn: "urn:li:share:123" }),
    true,
  );
  assertEquals(
    isConfirmedLinkedInPublishResult(true, { success: true }),
    false,
  );
});

Deno.test("pedido de texto com referência a imagem mantém a mídia", () => {
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "posta essa imagem no LinkedIn com um texto sobre automação",
    }),
    false,
  );
});

Deno.test("pedido explícito de texto no LinkedIn prepara prévia sem mídia", () => {
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "publica um texto no LinkedIn sobre automação",
    }),
    true,
  );
});

Deno.test("pedido genérico sem mídia não vira publicação só de texto", () => {
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "posta no LinkedIn sobre automação",
    }),
    false,
  );
});

Deno.test("referência de mídia recebida vence texto puro", () => {
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "publica um texto no LinkedIn",
      mediaId: "EA0BEE5B",
    }),
    false,
  );
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "publica um texto no LinkedIn",
      imageUrl: "https://example.com/imagem.jpg",
    }),
    false,
  );
});

Deno.test("distingue referência de mídia de pedido explicitamente textual", () => {
  assertEquals(publicationMediaReference("publica o vídeo no LinkedIn"), "video");
  assertEquals(publicationMediaReference("posta isso no LinkedIn"), "any");
  assertEquals(
    isExplicitTextOnlyPublication(
      "publica somente texto no LinkedIn sobre automação",
    ),
    true,
  );
});

Deno.test("falha no upload de vídeo impede a criação do post textual", async () => {
  const originalFetch = globalThis.fetch;
  let postAttempted = false;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://cdn.example/video.mp4") {
      return new Response(new Uint8Array([1, 2, 3]));
    }
    if (url.endsWith("/rest/videos?action=initializeUpload")) {
      return Response.json({
        value: {
          video: "urn:li:video:123",
          uploadInstructions: [{
            firstByte: 0,
            lastByte: 2,
            uploadUrl: "https://upload.example/video",
          }],
        },
      });
    }
    if (url === "https://upload.example/video" && init?.method === "PUT") {
      return new Response("upload failed", { status: 500 });
    }
    if (url.endsWith("/rest/posts")) postAttempted = true;
    return new Response("unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    await assertRejects(
      () =>
        criarPost({
          accessToken: "token",
          authorUrn: "urn:li:person:123",
          texto: "Copy",
          videoUrl: "https://cdn.example/video.mp4",
        }),
      Error,
      "Upload de vídeo falhou",
    );
    assertEquals(postAttempted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
