import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planBonusOperacionalUpserts, vencimentoFromCompetencia } from "./gestao-bonus-operacional-sync.ts";

Deno.test("vencimento competência abril", () => {
  assertEquals(vencimentoFromCompetencia("2026-04"), "2026-04-30");
});

Deno.test("plano upsert bônus", () => {
  const plan = planBonusOperacionalUpserts(
    [{ id: "b1", competencia: "2026-04", valor: 500, motivo: "Meta 100%" }],
    [],
  );
  assertEquals(plan.length, 1);
  assertEquals(plan[0].valor, 500);
});
