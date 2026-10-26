import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertMolicarQuota,
  isMolicarPriceCacheFresh,
  shouldRefundMolicarQuota,
} from "./molicar-service.ts";

Deno.test("MOLICAR-1 cache de preço respeita os dias configurados", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  assertEquals(
    isMolicarPriceCacheFresh({
      consultado_em: "2026-10-20T12:00:00Z",
      precos: { b2c: 100_000 },
    }, 7, now),
    true,
  );
  assertEquals(
    isMolicarPriceCacheFresh({
      consultado_em: "2026-10-18T12:00:00Z",
      precos: { b2c: 100_000 },
    }, 7, now),
    false,
  );
  assertEquals(
    isMolicarPriceCacheFresh({
      consultado_em: "2026-10-26T12:00:00Z",
      precos: { b2c: null, b2b: null },
    }, 7, now),
    false,
  );
});

Deno.test("MOLICAR-1 teto mensal bloqueia com mensagem clara", () => {
  assertMolicarQuota({ permitido: true, usado: 49, limite: 50 });
  assertThrows(
    () => assertMolicarQuota({ permitido: false, usado: 50, limite: 50 }),
    Error,
    "Teto do mês atingido (50/50)",
  );
});

Deno.test("MOLICAR-1.1 devolve cota em falhas técnicas, mas mantém cobrança do 404", () => {
  for (const status of [400, 401, 403, 429, 500, 502]) {
    assertEquals(shouldRefundMolicarQuota({ status }), true);
  }
  assertEquals(
    shouldRefundMolicarQuota(new Error("Tempo esgotado ao contactar a Molicar.")),
    true,
  );
  assertEquals(shouldRefundMolicarQuota({ status: 404 }), false);
});

Deno.test("MOLICAR-1.1 devolução no banco nunca deixa a cota negativa", async () => {
  const migration = await Deno.readTextFile(
    new URL("../../migrations/20261032280000_molicar_decoder_v3.sql", import.meta.url),
  );
  assertEquals(migration.includes("greatest(q.usado - 1, 0)"), true);
  assertEquals(
    migration.includes(
      "GRANT EXECUTE ON FUNCTION public.molicar_devolver_quota(uuid) TO service_role",
    ),
    true,
  );
});
