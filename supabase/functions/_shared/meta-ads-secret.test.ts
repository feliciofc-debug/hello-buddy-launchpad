import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decryptMetaAdsToken, encryptMetaAdsToken } from "./meta-ads-secret.ts";

Deno.test("Meta Ads token is encrypted at rest", async () => {
  const encrypted = await encryptMetaAdsToken("server-only-token", "key");
  assertNotEquals(encrypted.includes("server-only-token"), true);
  assertEquals(
    await decryptMetaAdsToken(encrypted, "key"),
    "server-only-token",
  );
  await assertRejects(() => decryptMetaAdsToken(encrypted, "wrong-key"));
});
