import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateGestaoComissaoValor } from "./gestao-comissao-guard.ts";

Deno.test("comissão >= valor da venda bloqueia sempre", () => {
  const r1 = validateGestaoComissaoValor(1_099_000, 1_099_000);
  assertEquals(r1.ok, false);
  if (!r1.ok) assertEquals(r1.code, "gte_venda");

  const r2 = validateGestaoComissaoValor(1_200_000, 1_099_000);
  assertEquals(r2.ok, false);
});

Deno.test("comissão acima de 10% exige confirmação explícita", () => {
  const blocked = validateGestaoComissaoValor(15_000, 100_000);
  assertEquals(blocked.ok, false);
  if (!blocked.ok) assertEquals(blocked.code, "above_10pct");

  const allowed = validateGestaoComissaoValor(15_000, 100_000, { allowAbove10Pct: true });
  assertEquals(allowed.ok, true);
});

Deno.test("comissão 1% da venda ok", () => {
  const r = validateGestaoComissaoValor(10_990, 1_099_000);
  assertEquals(r.ok, true);
});
