import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcSaldoProjetado } from "./gestao-fluxo-calc.ts";

Deno.test("projeção 30 dias soma contas em aberto", () => {
  const now = new Date(2026, 3, 15);
  const p = calcSaldoProjetado([
    {
      id: "1",
      tipo: "pagar",
      valor: 1_000,
      vencimento: "2026-04-20",
      pago_em: null,
      recebido_em: null,
      recorrencia_dia_mes: null,
    },
    {
      id: "2",
      tipo: "receber",
      valor: 5_000,
      vencimento: "2026-04-25",
      pago_em: null,
      recebido_em: null,
      recorrencia_dia_mes: null,
    },
  ], 30, now);
  assertEquals(p.saldoProjetado, 4_000);
});
