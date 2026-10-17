import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("vendido dispara patch closed (mock fetch)", async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/items/MLB1")) {
      calls.push(String(init?.body ?? ""));
      return Promise.resolve(new Response(JSON.stringify({ id: "MLB1", status: "closed" }), { status: 200 }));
    }
    if (url.includes("/oauth/token")) {
      return Promise.resolve(new Response(JSON.stringify({
        access_token: "t",
        refresh_token: "r",
        expires_in: 3600,
      }), { status: 200 }));
    }
    if (url.includes("/categories/")) {
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    }
    return original(input, init);
  };

  Deno.env.set("ML_TOKEN_KEY", btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  Deno.env.set("ML_CLIENT_ID", "1");
  Deno.env.set("ML_CLIENT_SECRET", "2");

  const { encryptMlSecret } = await import("./ml-token-crypto.ts");
  const enc = await encryptMlSecret("access");
  const encR = await encryptMlSecret("refresh");

  const sb = {
    from(table: string) {
      if (table === "veiculos_portais") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      external_id: "MLB1",
                      category_id: "MLB1744",
                      status: "published",
                    },
                  }),
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "veiculos_estoque") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "v1",
                    user_id: "u1",
                    marca: "BMW",
                    modelo: "X6",
                    versao: null,
                    status: "vendido",
                    fotos: ["https://x.com/1.jpg"],
                    preco: 100000,
                    km: 1,
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ml_contas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  user_id: "u1",
                  ml_user_id: 9,
                  nickname: "loja",
                  access_token_enc: enc,
                  refresh_token_enc: encR,
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                  status: "active",
                  refresh_lock_until: null,
                },
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "empresa_config") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  ml_location_json: {
                    location: {
                      city: { id: "c1" },
                      state: { id: "s1" },
                      country: { id: "BR" },
                    },
                  },
                },
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    },
  };

  const { resolveTenantOwner } = await import("./amz-context.ts");
  const origOwner = resolveTenantOwner;
  // @ts-ignore patch
  (globalThis as any).__resolveTenantOwner = origOwner;

  try {
    const { runMlVehicleSync } = await import("./ml-vehicle-sync-run.ts");
    // stub seller contact via dynamic import mock - skip if fails owner
    const result = await runMlVehicleSync(sb as never, { userId: "u1", veiculoId: "v1" });
    assertEquals(result.ok, true);
    assertEquals(calls.some((c) => c.includes('"status":"closed"')), true);
  } finally {
    globalThis.fetch = original;
  }
});
