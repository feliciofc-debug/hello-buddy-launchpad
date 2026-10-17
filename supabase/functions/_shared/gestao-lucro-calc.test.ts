import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcGestaoLucro, placaFinalLabel } from "./gestao-lucro-calc.ts";

Deno.test("lucro liquido vendido = venda - compra - despesas", () => {
  const r = calcGestaoLucro({
    valorCompra: 80000,
    despesas: [{ valor: 850, categoria: "pneus" }, { valor: 1200 }],
    valorVenda: 520000,
    precoAnunciado: null,
    dataCompra: "2026-01-01",
    dataVenda: "2026-02-01",
    statusVeiculo: "vendido",
  });
  assertEquals(r.lucroLiquido, 520000 - 80000 - 2050);
  assertEquals(r.diasEstoque, 31);
});

Deno.test("nao vendido: lucro projetado com preco anunciado", () => {
  const r = calcGestaoLucro({
    valorCompra: 100000,
    despesas: [{ valor: 5000 }],
    valorVenda: null,
    precoAnunciado: 130000,
    dataCompra: "2026-01-15",
    dataVenda: null,
    statusVeiculo: "disponivel",
  });
  assertEquals(r.lucroProjetado, 25000);
  assertEquals(r.lucroLiquido, null);
});

Deno.test("placaFinalLabel ultimos 4", () => {
  assertEquals(placaFinalLabel("ABC-1D23"), "1D23");
});

Deno.test("sem valor de compra: custo pendente, sem investido nem lucro projetado", () => {
  const r = calcGestaoLucro({
    valorCompra: null,
    despesas: [{ valor: 2000 }],
    valorVenda: null,
    precoAnunciado: 90000,
    dataCompra: null,
    dataVenda: null,
    statusVeiculo: "disponivel",
  });
  assertEquals(r.custoCompraPendente, true);
  assertEquals(r.investido, null);
  assertEquals(r.lucroProjetado, null);
  assertEquals(r.totalDespesas, 2000);
});
