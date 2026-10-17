import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContasVencemAmanhaReply, buildAReceberReply } from "./gestao-financeiro-inbound.ts";

Deno.test("contas amanhã", () => {
  const reply = buildContasVencemAmanhaReply([
    {
      id: "1",
      tipo: "pagar",
      valor: 100,
      vencimento: "2026-04-16",
      pago_em: null,
      recebido_em: null,
      recorrencia_dia_mes: null,
      categoria: "aluguel",
      observacao: null,
    },
  ], "2026-04-15");
  assertEquals(reply.includes("100"), true);
});

Deno.test("a receber total", () => {
  const reply = buildAReceberReply([
    {
      id: "1",
      tipo: "receber",
      valor: 5000,
      vencimento: "2026-04-20",
      pago_em: null,
      recebido_em: null,
      recorrencia_dia_mes: null,
      categoria: "financiamento_receber",
      observacao: null,
    },
  ]);
  assertEquals(reply.includes("5"), true);
});
