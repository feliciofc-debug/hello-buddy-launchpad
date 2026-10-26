// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  molicarDebtTotal,
  normalizeMolicarProcedenciaRows,
} from "./molicar-procedencia.ts";

Deno.test("normaliza envelope de registros da procedência", () => {
  const rows = normalizeMolicarProcedenciaRows({
    records: [{
      service: "gravame",
      state: "SUCCESS",
      result: { HasGravame: true },
    }],
  });
  assertEquals(rows[0].servico, "gravame");
  assertEquals(rows[0].status, "success");
  assertEquals(rows[0].resultado, { HasGravame: true });
});

Deno.test("soma resumo de débitos quando total não é informado", () => {
  const rows = normalizeMolicarProcedenciaRows({
    records: [{
      servico: "debts",
      status: "completed",
      resultado: {
        Debts: { Summary: { Licensing: 100, Ipva: 250, Fines: 50 } },
      },
    }],
  });
  assertEquals(molicarDebtTotal(rows), 400);
});

Deno.test("normaliza schema persistido e soma débitos dentro de Result", () => {
  const rows = normalizeMolicarProcedenciaRows({
    data: [{
      servicos: ["debts"],
      status: "concluida",
      solicitado_em: "2026-10-26T12:00:00Z",
      resultado: {
        Result: {
          Debts: { Summary: { Licensing: 90, Ipva: 210, Fines: 30 } },
        },
      },
    }],
  });
  assertEquals(rows[0].servico, "debts");
  assertEquals(rows[0].status, "concluida");
  assertEquals(rows[0].created_at, "2026-10-26T12:00:00Z");
  assertEquals(molicarDebtTotal(rows), 330);
});

Deno.test("soma débitos no envelope Data usado pelo fluxo assíncrono", () => {
  const rows = normalizeMolicarProcedenciaRows({
    data: [{
      servicos: ["debts"],
      status: "concluida",
      resultado: {
        Status: "SUCCESS",
        Data: {
          Debts: { Summary: { Licensing: 80, Ipva: 120, Fines: 25 } },
        },
      },
    }],
  });
  assertEquals(molicarDebtTotal(rows), 225);
});
