import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearMolicarTokenCacheForTest,
  molicarAccessToken,
  molicarVehicleQuery,
  restrictedAmzCredentials,
} from "./molicar-client.ts";

const token = (value: string) => ({
  accessToken: value,
  expiresAt: Date.now() + 3_600_000,
});

Deno.test("MOLICAR-1 401 força um único refresh", async () => {
  Deno.env.set("MOLICAR_DECODER_URL", "https://molicar.test");
  let calls = 0;
  const refreshes: boolean[] = [];
  const result = await molicarVehicleQuery({
    placa: "ABC1D23",
    getToken: (refresh) => {
      refreshes.push(refresh);
      return Promise.resolve(token(refresh ? "new" : "old"));
    },
    fetcher: ((url: string | URL | Request) => {
      calls++;
      assertEquals(String(url), "https://molicar.test/api/v3/plate/ABC1D23");
      return Promise.resolve(
        new Response(
          calls === 1 ? "{}" : '{"vehicle":{"id":"ok"}}',
          { status: calls === 1 ? 401 : 200 },
        ),
      );
    }) as typeof fetch,
  });
  assertEquals(result.status, 200);
  assertEquals(refreshes, [false, true]);
  assertEquals(calls, 2);
});

Deno.test("MOLICAR-1 429 não tenta novamente", async () => {
  Deno.env.set("MOLICAR_DECODER_URL", "https://molicar.test");
  let calls = 0;
  await assertRejects(
    () =>
      molicarVehicleQuery({
        placa: "ABC1D23",
        getToken: () => Promise.resolve(token("x")),
        fetcher: (() => {
          calls++;
          return Promise.resolve(new Response("{}", { status: 429 }));
        }) as typeof fetch,
      }),
    Error,
    "Limite de requisições",
  );
  assertEquals(calls, 1);
});

Deno.test("MOLICAR-1 cache OAuth evita nova autenticação", async () => {
  clearMolicarTokenCacheForTest();
  Deno.env.set("MOLICAR_TOKEN_URL", "https://molicar.test/token");
  let calls = 0;
  const fetcher = (() => {
    calls++;
    return Promise.resolve(
      new Response('{"access_token":"cached","expires_in":3600}'),
    );
  }) as typeof fetch;
  const input = {
    cacheKey: "store:client",
    credentials: { clientId: "client", clientSecret: "secret" },
    fetcher,
  };
  await molicarAccessToken(input);
  await molicarAccessToken(input);
  assertEquals(calls, 1);
});

Deno.test("MOLICAR-1 fallback AMZ exige UUID da loja explicitamente permitido", () => {
  Deno.env.set("MOLICAR_AMZ_TENANTS", "first, allowed, last");
  Deno.env.set("MOLICAR_DECODER_CLIENT_ID", "client");
  Deno.env.set("MOLICAR_DECODER_CLIENT_SECRET", "secret");
  assertEquals(restrictedAmzCredentials("other"), null);
  assertEquals(restrictedAmzCredentials("allowed"), {
    clientId: "client",
    clientSecret: "secret",
  });
});

Deno.test("MOLICAR-1 cliente não registra segredo, token, RENAVAM ou PII em log", async () => {
  const sources = await Promise.all([
    "molicar-client.ts",
    "molicar-parser.ts",
    "molicar-service.ts",
  ].map((file) => Deno.readTextFile(new URL(file, import.meta.url))));
  for (const source of sources) {
    assertEquals(/\bconsole\.(?:log|info|warn|error|debug)\s*\(/.test(source), false);
  }
});
