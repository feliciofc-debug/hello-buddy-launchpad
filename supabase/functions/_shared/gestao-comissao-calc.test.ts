import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcGestaoComissao,
  DEFAULT_COMISSAO_REGRA,
} from "./gestao-comissao-calc.ts";

Deno.test("comissão por faixa de margem no lucro", () => {
  const r = calcGestaoComissao({
    valorVenda: 520_000,
    lucroLiquido: 40_000,
    margemPct: 7.69,
    regra: { ...DEFAULT_COMISSAO_REGRA, usarFaixasMargem: true, pctSobreVenda: null },
  });
  assertEquals(r.pctLucroAplicado, 1);
  assertEquals(r.total, 400);
});

Deno.test("margem abaixo de 5% usa faixa 0,5%", () => {
  const r = calcGestaoComissao({
    valorVenda: 100_000,
    lucroLiquido: 3_000,
    margemPct: 3,
    regra: { ...DEFAULT_COMISSAO_REGRA, usarFaixasMargem: true, pctSobreVenda: null },
  });
  assertEquals(r.pctLucroAplicado, 0.5);
  assertEquals(r.total, 15);
});
