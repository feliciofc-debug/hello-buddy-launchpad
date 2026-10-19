import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  apiKeyUltimos4,
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
} from "./procedencia-enc-crypto.ts";

Deno.test("procedencia encrypt roundtrip", async () => {
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  Deno.env.set("PROCEDENCIA_ENC_KEY", keyB64);
  const enc = await encryptProcedenciaApiKey("sk-test-12345678");
  assertEquals(apiKeyUltimos4("sk-test-12345678"), "5678");
  const dec = await decryptProcedenciaApiKey(enc);
  assertEquals(dec, "sk-test-12345678");
});
