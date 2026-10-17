import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptWebmotorsSecret, encryptWebmotorsSecret } from "./webmotors-token-crypto.ts";

Deno.test("encrypt/decrypt Webmotors cred roundtrip", async () => {
  Deno.env.set(
    "WEBMOTORS_CRED_KEY",
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  );
  const enc = await encryptWebmotorsSecret("senha-integracao");
  assertEquals(await decryptWebmotorsSecret(enc), "senha-integracao");
});
