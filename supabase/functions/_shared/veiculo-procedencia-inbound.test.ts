import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatMolicarPlateResult,
  isProcedenciaWhatsAppRequest,
  lookupFipeForMolicarResult,
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
      lookupFipe: async () => null,
    },
  }) as never);
  assertEquals(calls, 1);
  assertStringIncludes(result.reply ?? "", "Preço Molicar");
  assertEquals(
    result.interactiveButtons?.buttons.map((button) => button.title),
    [
      "Procedência",
      "Usar na troca",
      "Cadastrar estoque",
    ],
  );
});

Deno.test("AJUSTES-04/11 — FIPE por código/ano/combustível entra antes dos preços Molicar", async () => {
  let lookupInput: Record<string, unknown> | null = null;
  const quote = await lookupFipeForMolicarResult({
    fipe_codigo: "001234-5",
    dados: {
      ano_modelo: 2022,
      combustivel: "Flex",
      carroceria: "Sedan",
    },
    precos: {},
  }, async (input) => {
    lookupInput = input;
    return {
      brand: "Toyota",
      model: "Corolla XEi",
      modelYear: 2022,
      fuel: "Gasolina",
      price: "R$ 112.345,00",
      referenceMonth: "novembro de 2026",
      codeFipe: "001234-5",
    };
  });
  assertEquals(lookupInput, {
    codeFipe: "001234-5",
    yearId: "2022-1",
    vehicleType: "cars",
  });
  const text = formatMolicarPlateResult({
    dados: {
      marca: "Toyota",
      modelo: "Corolla",
      ano_modelo: 2022,
      combustivel: "Flex",
    },
    precos: { referencia: 100_000, b2b: 90_000, c2b: 85_000 },
    fipe_quote: quote,
  });
  const lines = text.split("\n");
  assertStringIncludes(lines[4], "Tabela FIPE: R$ 112.345,00");
  assertStringIncludes(lines[4], "referência novembro de 2026");
  assertStringIncludes(lines[5], "Preço Molicar");
  assertEquals(lines[6], "B2B: R$ 90.000,00 · C2B: R$ 85.000,00");
});

Deno.test("AJUSTES-04/11.1 — cache antigo sem FIPE loga motivo curto", async () => {
  const logs: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const quote = await lookupFipeForMolicarResult({
      fipe_omit_motivo: "cache_antigo",
      fipe_codigo: null,
      dados: { ano_modelo: 2022, combustivel: "Flex" },
      precos: { referencia: 88_500 },
    });
    assertEquals(quote, null);
    assertEquals(logs.some((line) => line.includes("motivo=cache_antigo")), true);
  } finally {
    console.warn = original;
  }
});

Deno.test("AJUSTES-04/11.1 — consulta placa com cache sem fipe_codigo repassa refresh", async () => {
  let consultCalls = 0;
  let lookupCalls = 0;
  await tryProcessVeiculoProcedenciaInbound(baseInput({
    text: "QAY6I38",
    dependencies: {
      runConsulta: async () => {
        consultCalls += 1;
        return {
          cache: false,
          fipe_codigo: "001234-5",
          dados: {
            marca: "Toyota",
            modelo: "Corolla",
            ano_modelo: 2022,
            combustivel: "flex",
          },
          precos: { referencia: 88_500, b2b: 80_000, c2b: 75_000 },
          not_found: false,
        };
      },
      lookupFipe: async (result) => {
        lookupCalls += 1;
        assertEquals(result.fipe_codigo, "001234-5");
        return {
          price: "R$ 112.000,00",
          referenceMonth: "novembro de 2026",
          source: "fipe_publica",
        };
      },
    },
  }) as never);
  assertEquals(consultCalls, 1);
  assertEquals(lookupCalls, 1);
});

Deno.test("AJUSTES-04/11 — FIPE insegura ou indisponível é omitida", async () => {
  const invalid = await lookupFipeForMolicarResult({
    fipe_codigo: "001234-5",
    dados: { ano_modelo: 2022, combustivel: "Elétrico" },
    precos: {},
  }, async () => {
    throw new Error("não deveria consultar");
  });
  assertEquals(invalid, null);
  const text = formatMolicarPlateResult({
    dados: { marca: "GWM", modelo: "Ora 03", ano_modelo: 2024 },
    precos: { referencia: 150_000, b2b: 140_000, c2b: 130_000 },
    fipe_quote: null,
  });
  assertEquals(text.includes("Tabela FIPE:"), false);
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

function retrySb(source: Record<string, unknown>) {
  return {
    from(table: string) {
      if (table !== "molicar_procedencia") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: table === "profiles"
                    ? { tipo: "revenda_veiculos" }
                    : {
                      segmento: "automotivo",
                      sobre_negocio: "revenda de veículos",
                      vitrine_veiculos_demo: false,
                    },
                  error: null,
                }),
            }),
          }),
        };
      }
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        contains: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: () => {
          const matches = Object.entries(filters).every(([key, value]) =>
            source[key] === value
          );
          return Promise.resolve({
            data: matches ? source : null,
            error: null,
          });
        },
      };
      return query;
    },
  };
}

Deno.test("PROC-2 — retry recusa outro tenant e confirma somente debts", async () => {
  const source = {
    id: "debt-1",
    user_id: "u1",
    placa: "LMC5764",
    veiculo_id: "vehicle-1",
    troca_id: null,
    servicos: ["debts"],
    status: "erro",
    erro: "fonte_indisponivel",
  };
  const denied = await tryProcessVeiculoProcedenciaInbound(baseInput({
    sb: retrySb({ ...source, user_id: "outro-user" }),
    userText: "Tentar débitos",
    interactiveId: "proc_debitos_retry:debt-1",
  }) as never);
  assertStringIncludes(denied.reply ?? "", "desta loja");

  const agentState: Record<string, unknown> = {};
  const offered = await tryProcessVeiculoProcedenciaInbound(baseInput({
    sb: retrySb(source),
    agentState,
    userText: "Tentar débitos",
    interactiveId: "proc_debitos_retry:debt-1",
  }) as never);
  assertStringIncludes(offered.reply ?? "", "usa 1 consulta");
  assertEquals(
    offered.interactiveButtons?.buttons.map((button) => button.title),
    ["Confirmar", "Cancelar"],
  );

  let body: Record<string, unknown> | null = null;
  const confirmed = await tryProcessVeiculoProcedenciaInbound(baseInput({
    sb: retrySb(source),
    agentState,
    userText: "Confirmar",
    interactiveId: "molicar_wa:procedencia_confirmar",
    dependencies: {
      runProcedencia: async (_sb: unknown, _userId: string, input: unknown) => {
        body = input as Record<string, unknown>;
        return [{
          status: "pendente",
          solicitacao_id: "retry-request",
          servicos: ["debts"],
        }];
      },
    },
  }) as never);
  assertEquals(body?.services, ["debts"]);
  assertEquals(body?.veiculo_id, "vehicle-1");
  assertStringIncludes(confirmed.reply ?? "", "Nova consulta de débitos");
});
