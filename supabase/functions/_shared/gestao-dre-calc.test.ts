import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcDreMes } from "./gestao-dre-calc.ts";

Deno.test("DRE simples do mês", () => {
  const dre = calcDreMes("2026-04", [
    {
      veiculoId: "v1",
      dataVenda: "2026-04-10",
      valorVenda: 100_000,
      valorCompra: 80_000,
      despesas: [{ valor: 5_000, categoria: "mecanica" }, { valor: 1_000, categoria: "comissao" }],
    },
  ], [
    { categoria: "aluguel", valor: 3_000, vencimento: "2026-04-05", pagoEm: "2026-04-05" },
  ]);
  assertEquals(dre.faturamento, 100_000);
  assertEquals(dre.custoCarros, 80_000);
  assertEquals(dre.despesasCarros, 6_000);
  assertEquals(dre.lucroCarros, 14_000);
  assertEquals(dre.despesasOperacionais, 3_000);
  assertEquals(dre.lucroLiquidoLoja, 11_000);
});
