import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createRecentAutomaticMessageGuard,
  recognizedMediaReply,
} from "./media-received-copy.ts";

Deno.test("resposta de foto repetida usa concordância correta", () => {
  const reply = recognizedMediaReply({
    type: "foto",
    description: "Imagem de 06/10, 10:59.",
  });
  assertStringIncludes(reply, "esta imagem");
  assert(!reply.includes("este imagem"));
  assert(!reply.includes("tratá-lo"));
});

Deno.test("mensagem automática idêntica não é liberada novamente em 30 segundos", () => {
  const guard = createRecentAutomaticMessageGuard(30_000);
  assertEquals(guard.claim("tenant|contato|mensagem", 1_000).allowed, true);
  guard.complete("tenant|contato|mensagem", "wamid-1");
  assertEquals(guard.claim("tenant|contato|mensagem", 30_999), {
    allowed: false,
    receipt: "wamid-1",
  });
  assertEquals(
    guard.claim("tenant|outro-contato|mensagem", 30_999).allowed,
    true,
  );
  assertEquals(guard.claim("tenant|contato|mensagem", 31_000).allowed, true);
});
