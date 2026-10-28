import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMolicarProcedenciaWhatsAppSummary,
  molicarProcedenciaRetryButtons,
} from "./molicar-procedencia-notify.ts";

Deno.test("PROC-2 — fonte de débitos indisponível oferece retry sem texto técnico", () => {
  const rows = [{
    id: "debt-1",
    placa: "LMC5764",
    servicos: ["debts"],
    status: "erro",
    erro: "fonte_indisponivel",
    resultado: {
      Code: "UNPROCESSABLE_ENTITY",
      Message:
        "Unable to retrieve complete information at this time. Please try your request again.",
    },
  }];
  const summary = buildMolicarProcedenciaWhatsAppSummary(rows);
  assertStringIncludes(summary, "o Detran não respondeu agora");
  assertStringIncludes(summary, "Responda TENTAR DÉBITOS");
  assertEquals(
    molicarProcedenciaRetryButtons(rows)?.buttons[0].id,
    "proc_debitos_retry:debt-1",
  );
  assertEquals(summary.includes("UNPROCESSABLE_ENTITY"), false);
  assertEquals(summary.includes("Unable to retrieve"), false);
});

Deno.test("PROC-2 — Renajud vazio e fixture hipotética com dois itens", () => {
  const empty = buildMolicarProcedenciaWhatsAppSummary([{
    placa: "LMC5764",
    servicos: ["renajud"],
    status: "concluida",
    resultado: {
      Result: {
        Message: "No RENAJUD restrictions found for this vehicle.",
        Renajud: [],
      },
    },
  }]);
  assertStringIncludes(empty, "✅ Renajud: nada consta.");
  assertEquals(empty.includes("No RENAJUD"), false);

  // Fixture hipotética: a produção observada trouxe lista vazia.
  const two = buildMolicarProcedenciaWhatsAppSummary([{
    placa: "LMC5764",
    servicos: ["renajud"],
    status: "concluida",
    resultado: {
      Result: {
        Renajud: [
          { RestrictionType: "Judicial", Agency: "TJSP" },
          { Tipo: "Circulação", Orgao: "TRF" },
        ],
      },
    },
  }]);
  assertStringIncludes(two, "2 restrição(ões)");
});

Deno.test("PROC-2 — gravame ativo orienta e baixado não orienta", () => {
  const active = buildMolicarProcedenciaWhatsAppSummary([{
    placa: "LMC5764",
    servicos: ["gravame"],
    status: "concluida",
    resultado: {
      Result: {
        Gravame: [{
          Status: "ACTIVE",
          AgentName: "Bradesco Adm. Consórcios",
          ContractDate: "2014-03-20",
          ContractNumber: "SEGREDO-1",
          RestrictionId: "SEGREDO-2",
        }],
      },
    },
  }], { vehicleLabel: "Toyota Corolla Altis" });
  assertStringIncludes(
    active,
    "🔎 Procedência — LMC5764 (Toyota Corolla Altis)",
  );
  assertStringIncludes(active, "Gravame ATIVO");
  assertStringIncludes(active, "contrato de 2014");
  assertStringIncludes(active, "peça a carta de quitação");

  const inactive = buildMolicarProcedenciaWhatsAppSummary([{
    placa: "LMC5764",
    servicos: ["gravame"],
    status: "concluida",
    resultado: {
      Result: {
        Gravame: [{ Status: "BAIXADO", AgentName: "Banco Seguro" }],
      },
    },
  }]);
  assertStringIncludes(inactive, "baixado (não impede a transferência)");
  assertEquals(inactive.includes("carta de quitação"), false);

  for (
    const forbidden of [
      "Request completed",
      "not found",
      "não consultado",
      "ContractNumber",
      "RestrictionId",
      "Leilão",
      "Roubo/furto",
    ]
  ) {
    assertEquals(active.includes(forbidden), false, forbidden);
  }
});
