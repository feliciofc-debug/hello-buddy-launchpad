import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcVendaRaioX, rankPioresNegocios } from "./gestao-venda-raio-x.ts";

Deno.test("raio-x cascata e alerta vermelho comissão > 50% lucro", () => {
  const r = calcVendaRaioX({
    valorVenda: 300_000,
    valorCompra: 255_000,
    despesas: [
      { valor: 7_000, categoria: "mecanica" },
      { valor: 20_000, categoria: "comissao" },
    ],
  })!;
  assertEquals(r.lucroBruto, 38_000);
  assertEquals(r.comissao, 20_000);
  assertEquals(r.lucroFinal, 18_000);
  assertEquals(r.alertLevel, "red");
});

Deno.test("rank piores negócios por lucro final", () => {
  const base = {
    valorVenda: 100_000,
    valorCompra: 90_000,
    despesasSemComissao: 0,
    comissao: 0,
    margemBrutaPct: 10,
    comissaoPctDoLucro: 0,
    alertLevel: "none" as const,
    alertMessage: null,
    motivoProvavel: null,
    dataVenda: "2026-04-01",
    vendedorId: null,
    vendedorNome: null,
  };
  const ranked = rankPioresNegocios([
    { ...base, veiculoId: "a", label: "A", lucroBruto: 10_000, lucroFinal: 8_000, margemFinalPct: 8 },
    { ...base, veiculoId: "b", label: "B", lucroBruto: 5_000, lucroFinal: 2_000, margemFinalPct: 2 },
    { ...base, veiculoId: "c", label: "C", lucroBruto: 12_000, lucroFinal: 11_000, margemFinalPct: 11 },
  ]);
  assertEquals(ranked.map((x) => x.veiculoId), ["b", "a", "c"]);
});
