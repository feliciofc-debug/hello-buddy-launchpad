import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcDreMes } from "./gestao-dre-calc.ts";
import {
  planRecorrenciaLancamentos,
  vencimentoFromCompetenciaDia,
} from "./gestao-recorrencia-sync.ts";

const serie = {
  id: "s1",
  tipo: "pagar" as const,
  categoria_operacional: "aluguel",
  valor: 3000,
  dia_mes: 10,
  forma_pagamento: null,
  observacao: "Aluguel",
  veiculo_id: null,
  encerrada_a_partir_de: null,
};

Deno.test("gerar 3x = 1 lançamento por competência", () => {
  const now = new Date(2026, 9, 5);
  const existing: Parameters<typeof planRecorrenciaLancamentos>[1] = [];
  const p1 = planRecorrenciaLancamentos([serie], existing, now);
  existing.push(...p1.map((p) => ({
    serie_id: p.serie_id,
    competencia: p.competencia,
    id: "x",
    pago_em: null,
    recebido_em: null,
  })));
  const p2 = planRecorrenciaLancamentos([serie], existing, now);
  const p3 = planRecorrenciaLancamentos([serie], existing, now);
  assertEquals(p1.length, 2);
  assertEquals(p2.length, 0);
  assertEquals(p3.length, 0);
});

Deno.test("pagar outubro não remove lançamento de novembro", () => {
  const now = new Date(2026, 9, 15);
  const existing = [
    { serie_id: "s1", competencia: "2026-10", id: "o", pago_em: "2026-10-10", recebido_em: null },
    { serie_id: "s1", competencia: "2026-11", id: "n", pago_em: null, recebido_em: null },
  ];
  const plan = planRecorrenciaLancamentos([serie], existing, now);
  assertEquals(plan.length, 0);
  assertEquals(existing.find((e) => e.competencia === "2026-11")?.pago_em, null);
});

Deno.test("DRE novembro inclui aluguel recorrente", () => {
  const venc = vencimentoFromCompetenciaDia("2026-11", 10);
  const dre = calcDreMes("2026-11", [], [{
    categoria: "aluguel",
    valor: 3000,
    vencimento: venc,
    pagoEm: null,
  }]);
  assertEquals(dre.despesasOperacionais, 3000);
});
