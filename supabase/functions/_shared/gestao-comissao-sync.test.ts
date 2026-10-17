import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planGestaoComissaoSync } from "./gestao-comissao-sync.ts";
import { DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";

Deno.test("plano de comissão gera lançamento vendedor", () => {
  const plan = planGestaoComissaoSync({
    userId: "u",
    veiculoId: "v",
    vendedorId: "s1",
    vendedorNome: "João",
    gerenteId: null,
    valorVenda: 100_000,
    lucroLiquido: 10_000,
    margemPct: 10,
    regraVendedor: DEFAULT_COMISSAO_REGRA,
    regraGerente: null,
    valorComissaoOverride: null,
    dataDespesa: "2026-02-01",
  });
  assertEquals(plan.lancamentos.length, 1);
  assertEquals(plan.lancamentos[0].valor, 150);
});
