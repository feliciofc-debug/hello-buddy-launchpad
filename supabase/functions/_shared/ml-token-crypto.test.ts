import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptMlSecret, encryptMlSecret } from "./ml-token-crypto.ts";

Deno.test("encrypt/decrypt ML token roundtrip", async () => {
  Deno.env.set("ML_TOKEN_KEY", btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  const enc = await encryptMlSecret("secret-token");
  assertEquals(await decryptMlSecret(enc), "secret-token");
});
