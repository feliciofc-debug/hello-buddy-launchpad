import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMolicarProcedenciaWhatsAppSummary } from "./molicar-procedencia-notify.ts";

Deno.test("VEIC-WPP-1 — resumo assíncrono distingue consultado de não consultado", () => {
  const summary = buildMolicarProcedenciaWhatsAppSummary([
    {
      servicos: ["debts"],
      status: "concluida",
      resultado: {
        Debts: {
          Details: [
            { Description: "IPVA", Total: 1234.56 },
            { Description: "Multa", Total: 200 },
          ],
        },
      },
    },
    {
      servicos: ["gravame"],
      status: "concluida",
      resultado: {
        Gravame: [{ AgentName: "Banco Seguro", Status: "ATIVO" }],
      },
    },
    {
      servicos: ["renajud"],
      status: "erro",
      resultado: null,
    },
  ]);
  assertStringIncludes(summary, "Débitos: 2 registro(s)");
  assertStringIncludes(summary, "Gravame: 1 registro(s); Banco Seguro");
  assertStringIncludes(summary, "Restrições: não consultado");
  assertEquals(summary.includes("nenhum alerta"), false);
});

Deno.test("VEIC-WPP-1 — recurso ausente não é apresentado como sem alerta", () => {
  const summary = buildMolicarProcedenciaWhatsAppSummary([
    {
      servicos: ["debts"],
      status: "concluida",
      provider_status: "RESOURCE_NOT_FOUND",
    },
    { servicos: ["gravame"], status: "erro" },
    { servicos: ["renajud"], status: "expirada" },
  ]);
  assertStringIncludes(summary, "veículo não encontrado na base");
  assertStringIncludes(summary, "Gravame: não consultado");
  assertStringIncludes(summary, "Restrições: não consultado");
});
