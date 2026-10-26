import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertMolicarQuota,
  isMolicarPriceCacheFresh,
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
