import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chamarRenave } from "./renave-client.ts";

async function withRenaveEnv(run: () => Promise<void>): Promise<void> {
  const oldUrl = Deno.env.get("AMZ_RENAVE_URL");
  const oldToken = Deno.env.get("AMZ_RENAVE_TOKEN");
  Deno.env.set("AMZ_RENAVE_URL", "http://127.0.0.1:3012");
  Deno.env.set("AMZ_RENAVE_TOKEN", "token-sintetico");
  try {
    await run();
  } finally {
    if (oldUrl == null) Deno.env.delete("AMZ_RENAVE_URL");
    else Deno.env.set("AMZ_RENAVE_URL", oldUrl);
    if (oldToken == null) Deno.env.delete("AMZ_RENAVE_TOKEN");
    else Deno.env.set("AMZ_RENAVE_TOKEN", oldToken);
  }
}

Deno.test({
  name: "RENAVE-1 — cliente chama operação tipada com token",
  permissions: { env: true },
  fn: () =>
    withRenaveEnv(async () => {
      let calls = 0;
      const fetchMock = ((
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        calls++;
        assertEquals(
          String(input),
          "http://127.0.0.1:3012/renave/chamar",
        );
        assertEquals(init?.method, "POST");
        assertEquals(
          new Headers(init?.headers).get("X-RENAVE-Token"),
          "token-sintetico",
        );
        assertEquals(JSON.parse(String(init?.body)), {
          ambiente: "hom",
          operacao: "aptidaoVeiculo",
          params: { placa: "ABC1D23", tipoCrv: "DIGITAL" },
        });
        assertEquals(init?.signal instanceof AbortSignal, true);
        return Promise.resolve(
          new Response(JSON.stringify({
            status: 200,
            body: { apto: true },
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }) as typeof fetch;

      const result = await chamarRenave<
        "aptidaoVeiculo",
        { apto: boolean }
      >({
        ambiente: "hom",
        operacao: "aptidaoVeiculo",
        params: { placa: "ABC1D23", tipoCrv: "DIGITAL" },
      }, fetchMock);
      assertEquals(calls, 1);
      assertEquals(result, { status: 200, body: { apto: true } });
    }),
});

Deno.test({
  name: "RENAVE-1 — cliente não repassa corpo de erro local",
  permissions: { env: true },
  fn: () =>
    withRenaveEnv(async () => {
      await assertRejects(
        () =>
          chamarRenave({
            ambiente: "hom",
            operacao: "clienteAutenticado",
            params: {},
          }, (() =>
            Promise.resolve(
              new Response(JSON.stringify({ segredo: "não repassar" }), {
                status: 401,
              }),
            )) as typeof fetch),
        Error,
        "amz-renave indisponível (401)",
      );
    }),
});

Deno.test({
  name: "RENAVE-1 — cliente rejeita envelope de resposta inválido",
  permissions: { env: true },
  fn: () =>
    withRenaveEnv(async () => {
      await assertRejects(
        () =>
          chamarRenave({
            ambiente: "hom",
            operacao: "municipios",
            params: { uf: "RJ" },
          }, (() =>
            Promise.resolve(
              new Response(JSON.stringify({ status: "200", body: [] })),
            )) as typeof fetch),
        Error,
        "Resposta inválida",
      );
    }),
});

Deno.test("RENAVE-1 — timeout do cliente é 35 segundos", async () => {
  const source = await Deno.readTextFile(
    new URL("./renave-client.ts", import.meta.url),
  );
  assertEquals(source.includes("AbortSignal.timeout(35_000)"), true);
});
