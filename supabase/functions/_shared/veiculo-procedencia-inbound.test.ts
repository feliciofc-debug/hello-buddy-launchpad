import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatMolicarPlateResult,
  isProcedenciaWhatsAppRequest,
  parseMolicarPlateLookupText,
  parsePlacaFromProcedenciaText,
  tryProcessVeiculoProcedenciaInbound,
} from "./veiculo-procedencia-inbound.ts";
import { MolicarDailyLimitError } from "./molicar-service.ts";

Deno.test("VEIC-WPP-1 — reconhece placa pura e pedidos estritos", () => {
  assertEquals(parsePlacaFromProcedenciaText("procedência ABC1D23"), "ABC1D23");
  assertEquals(parseMolicarPlateLookupText("LMC5764"), "LMC5764");
  assertEquals(parseMolicarPlateLookupText("lmc-5764"), "LMC5764");
  assertEquals(parseMolicarPlateLookupText("LMC5H64"), "LMC5H64");
  assertEquals(parseMolicarPlateLookupText("placa LMC5764"), "LMC5764");
  assertEquals(
    parseMolicarPlateLookupText("consulta a placa LMC5764"),
    "LMC5764",
  );
  assertEquals(parseMolicarPlateLookupText("vendi a placa LMC5764"), null);
});

Deno.test("VEIC-WPP-1 — procedência é distinta da consulta simples", () => {
  assert(isProcedenciaWhatsAppRequest("procedência ABC1D23"));
  assert(!isProcedenciaWhatsAppRequest("consulta a placa ABC1D23"));
  assert(!isProcedenciaWhatsAppRequest("qual a fipe"));
  assertEquals(
    formatMolicarPlateResult({
      dados: {
        marca: "Toyota",
        modelo: "Corolla",
        versao: "XEi",
        ano_modelo: 2022,
        combustivel: "flex",
      },
      precos: {
        referencia: 100_000,
        b2b: 90_000,
        c2b: 85_000,
        b2c: 110_000,
        c2c: 105_000,
      },
    }).includes("B2C"),
    false,
  );
});

function gateSb() {
  return {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: table === "profiles" ? { tipo: "revenda_veiculos" } : {
                  segmento: "automotivo",
                  sobre_negocio: "revenda de veículos",
                  vitrine_veiculos_demo: false,
                },
              }),
          }),
        }),
      };
    },
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  const agentState: Record<string, unknown> = {};
  return {
    sb: gateSb(),
    userId: "u1",
    fromNumber: "5511999999999",
    userText: "LMC5764",
    hasInboundMedia: false,
    auth: {
      ownerPhone: "5511999999999",
      ownerAltPhones: [],
      gestores: [],
    },
    agentState,
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      Object.assign(current, patch);
      return true;
    },
    ...overrides,
  };
}

Deno.test("VEIC-WPP-1 — placa pura consulta Molicar e oferece três ações", async () => {
  let calls = 0;
  const result = await tryProcessVeiculoProcedenciaInbound(baseInput({
    dependencies: {
      runConsulta: async () => {
        calls++;
        return {
          dados: {
            marca: "Toyota",
            modelo: "Corolla",
            versao: "XEi",
            ano_modelo: 2022,
            combustivel: "flex",
          },
          precos: { referencia: 100_000, b2b: 90_000, c2b: 85_000 },
          not_found: false,
        };
      },
    },
  }) as never);
  assertEquals(calls, 1);
  assertStringIncludes(result.reply ?? "", "Molicar Price");
  assertEquals(
    result.interactiveButtons?.buttons.map((button) => button.title),
    [
      "Procedência",
      "Usar na troca",
      "Cadastrar estoque",
    ],
  );
});

Deno.test("VEIC-WPP-1 — cache negativo e limite diário têm respostas estáveis", async () => {
  const notFound = await tryProcessVeiculoProcedenciaInbound(baseInput({
    dependencies: {
      runConsulta: async () => ({ not_found: true }),
    },
  }) as never);
  assertEquals(
    notFound.reply,
    "Não encontrei essa placa na Molicar. Confere as letras?",
  );
  const limited = await tryProcessVeiculoProcedenciaInbound(baseInput({
    dependencies: {
      runConsulta: async () => {
        throw new MolicarDailyLimitError();
      },
    },
  }) as never);
  assertStringIncludes(limited.reply ?? "", "limite de 30 consultas");
});

Deno.test("VEIC-WPP-1 — cliente ou parceiro não aciona consulta", async () => {
  let calls = 0;
  const result = await tryProcessVeiculoProcedenciaInbound(baseInput({
    auth: { ownerPhone: "5511888888888", ownerAltPhones: [], gestores: [] },
    dependencies: {
      runConsulta: async () => {
        calls++;
        return {};
      },
    },
  }) as never);
  assertEquals(result.handled, false);
  assertEquals(calls, 0);
});

Deno.test("VEIC-WPP-1 — procedência mostra custo, confirma e usa Molicar", async () => {
  const input = baseInput({
    userText: "procedência LMC5764",
  });
  const offered = await tryProcessVeiculoProcedenciaInbound(input as never);
  assertStringIncludes(offered.reply ?? "", "custo: 3 consultas");
  assertEquals(
    offered.interactiveButtons?.buttons.map((button) => button.title),
    ["Confirmar", "Cancelar"],
  );
  let started = 0;
  let notified = 0;
  const confirmed = await tryProcessVeiculoProcedenciaInbound({
    ...input,
    userText:
      "Confirmar\n<<INTERACTIVE_ID:molicar_wa:procedencia_confirmar>>",
    dependencies: {
      runProcedencia: async () => {
        started++;
        return [
          { status: "concluida", solicitacao_id: "s1" },
          { status: "erro", solicitacao_id: "s1" },
          { status: "concluida", solicitacao_id: "s1" },
        ];
      },
      notifyProcedencia: async () => {
        notified++;
        return true;
      },
    },
  } as never);
  assertEquals(started, 1);
  assertEquals(notified, 1);
  assertStringIncludes(confirmed.reply ?? "", "Avisarei o dono");
});
