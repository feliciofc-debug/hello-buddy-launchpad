import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isConfirmedLinkedInPublishResult,
  sanitizeLinkedInApprovalCopy,
  shouldPrepareLinkedInTextOnly,
} from "./linkedin-approval.ts";

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

Deno.test("pedido de post no LinkedIn sem mídia prepara prévia de texto", () => {
  assertEquals(
    shouldPrepareLinkedInTextOnly({
      requestText: "posta no LinkedIn sobre automação",
    }),
    true,
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
