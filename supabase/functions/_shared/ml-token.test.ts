import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getMlAccessTokenForUser, saveMlContaTokens } from "./ml-token.ts";

Deno.test("getMlAccessTokenForUser usa token válido sem refresh", async () => {
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  Deno.env.set("ML_TOKEN_KEY", key);
  Deno.env.set("ML_CLIENT_ID", "cid");
  Deno.env.set("ML_CLIENT_SECRET", "sec");

  const { encryptMlSecret } = await import("./ml-token-crypto.ts");
  const enc = await encryptMlSecret("access-ok");
  const encR = await encryptMlSecret("refresh-ok");
  const sb = {
    from(_t: string) {
      return {
        select(_c: string) {
          return {
            eq(_a: string, v: string) {
              return {
                maybeSingle: async () => ({
                  data: {
                    user_id: v,
                    ml_user_id: 99,
                    nickname: "loja",
                    access_token_enc: enc,
                    refresh_token_enc: encR,
                    expires_at: new Date(Date.now() + 3600_000).toISOString(),
                    status: "active",
                    refresh_lock_until: null,
                  },
                }),
              };
            },
          };
        },
        update(_row: Record<string, unknown>) {
          return { eq: async () => ({ error: null }) };
        },
        upsert: async () => ({ error: null }),
      };
    },
  };

  const out = await getMlAccessTokenForUser(sb as never, "u1");
  assertEquals(out.accessToken, "access-ok");
  assertEquals(out.mlUserId, 99);
});

Deno.test("saveMlContaTokens cifra tokens", async () => {
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  Deno.env.set("ML_TOKEN_KEY", key);
  let stored: Record<string, unknown> | null = null;
  const sb = {
    from(_t: string) {
      return {
        upsert(row: Record<string, unknown>) {
          stored = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await saveMlContaTokens(sb as never, {
    userId: "u1",
    mlUserId: 1,
    nickname: "x",
    accessToken: "a",
    refreshToken: "r",
    expiresInSec: 100,
  });
  assertEquals(stored?.user_id, "u1");
  assertEquals(String(stored?.access_token_enc).startsWith("mlv1:"), true);
});

Deno.test("getMlAccessTokenForUser rejeita revogado", async () => {
  const sb = {
    from(_t: string) {
      return {
        select(_c: string) {
          return {
            eq(_a: string, _v: string) {
              return {
                maybeSingle: async () => ({
                  data: { status: "revoked" },
                }),
              };
            },
          };
        },
      };
    },
  };
  await assertRejects(
    () => getMlAccessTokenForUser(sb as never, "u1"),
    Error,
    "ml_not_connected",
  );
});
