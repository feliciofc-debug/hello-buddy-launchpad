import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcMetaProgresso } from "./gestao-meta-calc.ts";

Deno.test("projeção de meta no ritmo atual", () => {
  const p = calcMetaProgresso(
    {
      tipo: "qtd",
      metaValor: 10,
      bonusEscalonado: [
        { pctMeta: 100, bonus: 1000 },
        { pctMeta: 120, bonus: 2500 },
      ],
      bonusCarroParado90: 500,
    },
    4,
    new Date(2026, 3, 15),
  );
  assertEquals(p.pctAtingido, 40);
  assertEquals(p.projecaoPct, 80);
  assertEquals(p.bonusEstimado, 0);
});
