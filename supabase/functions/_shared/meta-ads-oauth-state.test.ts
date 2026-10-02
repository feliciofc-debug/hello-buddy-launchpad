import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createMetaAdsOAuthState,
  verifyMetaAdsOAuthState,
} from "./meta-ads-oauth-state.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "segredo-de-teste";
const NOW = Date.parse("2026-10-02T11:00:00Z");

function decodePayload(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
}

function encodePayload(value: string): string {
  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

Deno.test("state Meta Ads válido identifica o usuário autenticado", async () => {
  const state = await createMetaAdsOAuthState({
    userId: USER_ID,
    secret: SECRET,
    nowMs: NOW,
    nonce: "nonce_seguro_123",
  });
  assertEquals(
    await verifyMetaAdsOAuthState({ state, secret: SECRET, nowMs: NOW }),
    { ok: true, userId: USER_ID },
  );
});

Deno.test("state Meta Ads rejeita assinatura adulterada", async () => {
  const state = await createMetaAdsOAuthState({
    userId: USER_ID,
    secret: SECRET,
    nowMs: NOW,
    nonce: "nonce_seguro_123",
  });
  const [payload, signature] = state.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}${
    signature.endsWith("A") ? "B" : "A"
  }`;
  assertEquals(
    await verifyMetaAdsOAuthState({
      state: tampered,
      secret: SECRET,
      nowMs: NOW,
    }),
    { ok: false, reason: "invalid" },
  );
});

Deno.test("state Meta Ads rejeita prazo expirado", async () => {
  const state = await createMetaAdsOAuthState({
    userId: USER_ID,
    secret: SECRET,
    nowMs: NOW,
    nonce: "nonce_seguro_123",
  });
  assertEquals(
    await verifyMetaAdsOAuthState({
      state,
      secret: SECRET,
      nowMs: NOW + 10 * 60 * 1000,
    }),
    { ok: false, reason: "expired" },
  );
});

Deno.test("state Meta Ads rejeita troca de user_id no payload", async () => {
  const state = await createMetaAdsOAuthState({
    userId: USER_ID,
    secret: SECRET,
    nowMs: NOW,
    nonce: "nonce_seguro_123",
  });
  const [payload, signature] = state.split(".");
  const changedPayload = encodePayload(
    decodePayload(payload).replace(USER_ID, OTHER_USER_ID),
  );
  assertEquals(
    await verifyMetaAdsOAuthState({
      state: `${changedPayload}.${signature}`,
      secret: SECRET,
      nowMs: NOW,
    }),
    { ok: false, reason: "invalid" },
  );
});
