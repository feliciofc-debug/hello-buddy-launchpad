import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptGestaoIntegracaoSecret, encryptGestaoIntegracaoSecret } from "./gestao-integracoes-crypto.ts";

Deno.test("encrypt/decrypt gestão integrações roundtrip", async () => {
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  Deno.env.set("GESTAO_INTEGRACOES_KEY", key);
  const enc = await encryptGestaoIntegracaoSecret("zapsign-token-test");
  assertEquals(enc.startsWith("giv1:"), true);
  const plain = await decryptGestaoIntegracaoSecret(enc);
  assertEquals(plain, "zapsign-token-test");
});
