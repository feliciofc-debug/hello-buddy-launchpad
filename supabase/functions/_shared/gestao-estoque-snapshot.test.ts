import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoEstoqueSnapshot,
  daysInStock,
  gestaoEstoqueIdadeFaixa,
} from "./gestao-estoque-snapshot.ts";

Deno.test("idade do estoque usa data_compra quando existe", () => {
  const now = Date.parse("2026-02-01");
  assertEquals(daysInStock("2026-01-15", "2020-01-01", now), 17);
  assertEquals(gestaoEstoqueIdadeFaixa(17), "0-30");
});

Deno.test("snapshot separa disponível e reservado e lucro projetado", () => {
  const snap = buildGestaoEstoqueSnapshot([
    {
      id: "1",
      marca: "BMW",
      preco: 200_000,
      status: "disponivel",
      dataCompra: "2026-01-01",
      valorCompra: 150_000,
      despesasTotal: 5_000,
    },
    {
      id: "2",
      marca: "Audi",
      preco: 100_000,
      status: "reservado",
      dataCompra: "2025-10-01",
      valorCompra: 80_000,
      despesasTotal: 2_000,
    },
    {
      id: "3",
      marca: "Fiat",
      preco: 50_000,
      status: "vendido",
      dataCompra: "2025-01-01",
      valorCompra: 40_000,
      despesasTotal: 0,
    },
  ], Date.parse("2026-02-01"));

  assertEquals(snap.totais.quantidade, 2);
  assertEquals(snap.totais.valorVenda, 300_000);
  assertEquals(snap.totais.valorCusto, 237_000);
  assertEquals(snap.totais.lucroProjetado, 63_000);
  assertEquals(snap.porStatus.disponivel.quantidade, 1);
  assertEquals(snap.porStatus.reservado.valorVenda, 100_000);
  assertEquals(snap.porMarca[0].marca, "BMW");
});

Deno.test("custo pendente não entra no custo nem no lucro projetado", () => {
  const snap = buildGestaoEstoqueSnapshot([
    {
      id: "1",
      marca: "VW",
      preco: 80_000,
      status: "disponivel",
      dataCompra: null,
      valorCompra: null,
      despesasTotal: 3_000,
    },
    {
      id: "2",
      marca: "Honda",
      preco: 120_000,
      status: "disponivel",
      dataCompra: "2026-01-01",
      valorCompra: 90_000,
      despesasTotal: 0,
    },
  ], Date.parse("2026-02-01"));

  assertEquals(snap.custoPendente.quantidade, 1);
  assertEquals(snap.custoPendente.valorAnunciado, 80_000);
  assertEquals(snap.totais.valorVenda, 200_000);
  assertEquals(snap.totais.valorCusto, 90_000);
  assertEquals(snap.totais.lucroProjetado, 30_000);
});
