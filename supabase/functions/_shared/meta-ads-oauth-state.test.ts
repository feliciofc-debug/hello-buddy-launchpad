import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  signMetaAdsOAuthState,
  verifyMetaAdsOAuthState,
} from "./meta-ads-oauth-state.ts";

Deno.test("OAuth state is signed, tamper-resistant, and expiring", async () => {
  const state = {
    userId: "user",
    nonce: "nonce",
    expiresAt: 2_000,
    returnTo: "https://app.test",
  };
  const signed = await signMetaAdsOAuthState(state, "secret");
  assertEquals(await verifyMetaAdsOAuthState(signed, "secret", 1_000), state);
  await assertRejects(() =>
    verifyMetaAdsOAuthState(`${signed}x`, "secret", 1_000)
  );
  await assertRejects(() => verifyMetaAdsOAuthState(signed, "secret", 3_000));
});
