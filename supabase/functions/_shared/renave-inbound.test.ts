import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resetProcedenciaEncKeyCache } from "./procedencia-enc-crypto.ts";
import {
  formatAptitude,
  generateRenaveMockSuffix,
  generateValidCpf,
  parseAptitudeIdentifiers,
  parseCrvDetails,
  parsePurchaseDetails,
  parseRenaveCommand,
  tryProcessRenaveInbound,
  validateCpfCnpj,
} from "./renave-inbound.ts";
import {
  encryptRenaveOperatorProfile,
  encryptRenaveSensitiveState,
} from "./renave-state-crypto.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER = "5511999999999";
const NOW = new Date("2026-11-06T15:00:00Z");
const CPF = "52998224725";
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

function setEnv(enabled = true): () => void {
  const oldUsers = Deno.env.get("AMZ_RENAVE_HOM_USER_IDS");
  const oldEnvironment = Deno.env.get("AMZ_RENAVE_AMBIENTE");
  const oldKey = Deno.env.get("PROCEDENCIA_ENC_KEY");
  if (enabled) Deno.env.set("AMZ_RENAVE_HOM_USER_IDS", USER_ID);
  else Deno.env.delete("AMZ_RENAVE_HOM_USER_IDS");
  Deno.env.set("AMZ_RENAVE_AMBIENTE", "hom");
  Deno.env.set("PROCEDENCIA_ENC_KEY", KEY);
  resetProcedenciaEncKeyCache();
  return () => {
    if (oldUsers == null) Deno.env.delete("AMZ_RENAVE_HOM_USER_IDS");
    else Deno.env.set("AMZ_RENAVE_HOM_USER_IDS", oldUsers);
    if (oldEnvironment == null) Deno.env.delete("AMZ_RENAVE_AMBIENTE");
    else Deno.env.set("AMZ_RENAVE_AMBIENTE", oldEnvironment);
    if (oldKey == null) Deno.env.delete("PROCEDENCIA_ENC_KEY");
    else Deno.env.set("PROCEDENCIA_ENC_KEY", oldKey);
    resetProcedenciaEncKeyCache();
  };
}

function baseInput(
  agentState: Record<string, unknown>,
  userText: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    userId: USER_ID,
    fromNumber: OWNER,
    userText,
    interactiveId: null,
    hasInboundMedia: false,
    auth: {
      ownerPhone: OWNER,
      ownerAltPhones: [],
      gestores: ["5521888888888"],
    },
    agentState,
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      Object.assign(current, patch);
      return true;
    },
    dependencies: {
      now: () => NOW,
      mockSuffix: () => "1A23",
      mockCpf: () => CPF,
      callRenave: async () => ({ status: 200, body: {} }),
    },
    ...overrides,
  };
}

Deno.test("RENAVE-2 — parser exige renave e reconhece comandos", () => {
  assertEquals(parseRenaveCommand("entrada ABC1D23"), null);
  assertEquals(parseRenaveCommand("renave teste"), { kind: "teste" });
  assertEquals(parseRenaveCommand("renave estoque"), { kind: "estoque" });
  assertEquals(parseRenaveCommand("renave entrada ABC1D23"), {
    kind: "entrada",
    placa: "ABC1D23",
  });
  assertEquals(parseRenaveCommand("renave aptidão ABC1D23"), {
    kind: "aptidao",
    placa: "ABC1D23",
    text: "renave aptidão ABC1D23",
  });
  assertEquals(parseRenaveCommand("renave consulta ABC1D23")?.kind, "aptidao");
});

Deno.test("RENAVE-2 — valida documentos e dados das duas etapas", () => {
  assertEquals(validateCpfCnpj(CPF), "CPF");
  assertEquals(validateCpfCnpj("85106037000585"), "CNPJ");
  assertEquals(validateCpfCnpj("11111111111"), null);
  assertEquals(
    parseCrvDetails(
      "renavam 12345678901, crv 123456789012, codigo 12345678901, tipo azul",
    ),
    {
      renavam: "12345678901",
      numeroCrv: "123456789012",
      codigoSegurancaCrv: "12345678901",
      tipoCrv: "AZUL",
    },
  );
  assertEquals(
    parseAptitudeIdentifiers(
      "renave aptidão ABC1D23 renavam 12345678901 crv 123456789012",
    ),
    {
      renavam: "12345678901",
      numeroCrv: "123456789012",
      tipoCrv: "AZUL",
    },
  );
  assertEquals(
    parsePurchaseDetails(
      `km 12.000, valor R$ 45.500,50, data hoje, CPF ${CPF}`,
      NOW,
    ),
    {
      quilometragem: 12000,
      valorCompra: 45500.5,
      dataCompra: "2026-11-06",
      documentoProprietario: CPF,
      tipoDocumento: "CPF",
    },
  );
  assertEquals(
    parsePurchaseDetails("km -1 valor 0 data 31/02/2026", NOW),
    null,
  );
  assertMatch(generateRenaveMockSuffix(), /^[0-9][A-HJ][0-9]{2}$/);
  assertEquals(validateCpfCnpj(generateValidCpf()), "CPF");
});

Deno.test("RENAVE-2 — gate recusa sem env, outro tenant, gestor e mídia", async () => {
  const restore = setEnv(false);
  try {
    const noEnv = await tryProcessRenaveInbound(
      baseInput({}, "renave teste") as never,
    );
    assertEquals(noEnv.handled, false);

    Deno.env.set("AMZ_RENAVE_HOM_USER_IDS", USER_ID);
    const otherTenant = await tryProcessRenaveInbound(
      baseInput({}, "renave teste", { userId: "outro" }) as never,
    );
    assertEquals(otherTenant.handled, false);
    const manager = await tryProcessRenaveInbound(
      baseInput({}, "renave teste", {
        fromNumber: "5521888888888",
      }) as never,
    );
    assertEquals(manager.handled, false);
    const media = await tryProcessRenaveInbound(
      baseInput({}, "renave teste", { hasInboundMedia: true }) as never,
    );
    assertEquals(media.handled, false);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — ambiente prod fica bloqueado", async () => {
  const restore = setEnv();
  try {
    Deno.env.set("AMZ_RENAVE_AMBIENTE", "prod");
    const result = await tryProcessRenaveInbound(
      baseInput({}, "renave teste") as never,
    );
    assertEquals(result.handled, true);
    assertStringIncludes(result.reply ?? "", "produção ainda não liberado");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — fluxo mock, aptidão, entrada e confirmação é completo", async () => {
  const restore = setEnv();
  const agentState: Record<string, unknown> = {};
  const calls: Record<string, unknown>[] = [];
  const logs: unknown[][] = [];
  const oldInfo = console.info;
  console.info = (...args: unknown[]) => logs.push(args);
  try {
    const callRenave = async (call: Record<string, unknown>) => {
      calls.push(call);
      if (call.operacao === "mockVeiculoUsado") {
        return {
          status: 201,
          body: {
            placa: "ABC1A23",
            renavam: "12345678901",
            numeroCrv: "123456789012",
            codigoSegurancaCrv: "98765432101",
          },
        };
      }
      if (call.operacao === "aptidaoVeiculo") {
        return {
          status: 200,
          body: {
            diagnostico: { veiculoApto: true },
            informacoesDebitos: {
              valorDebitoIpva: 120.5,
              valorDebitoLicenciamento: 0,
              valorDebitoMultas: 30,
            },
          },
        };
      }
      return {
        status: 201,
        body: { id: 42, estado: "SOLICITADO" },
      };
    };
    const dependencies = {
      now: () => NOW,
      mockSuffix: () => "1A23",
      mockCpf: () => CPF,
      loadTenantEmail: async () => "loja@exemplo.com.br",
      callRenave,
    };

    const mock = await tryProcessRenaveInbound(
      baseInput(agentState, "renave teste", { dependencies }) as never,
    );
    assertStringIncludes(mock.reply ?? "", "ABC1A23");
    const serializedMock = JSON.stringify(agentState.renave_mock_ultimo);
    assertEquals(serializedMock.includes(CPF), false);
    assertEquals(serializedMock.includes("98765432101"), false);
    assertStringIncludes(serializedMock, "proc1:");

    const entry = await tryProcessRenaveInbound(
      baseInput(agentState, "renave entrada ABC1A23", {
        dependencies,
      }) as never,
    );
    assertStringIncludes(entry.reply ?? "", "✅ Apto");
    assertStringIncludes(entry.reply ?? "", "IPVA");
    assertEquals(
      (agentState.pending_renave_entrada as Record<string, unknown>).phase,
      "operador_cpf",
    );
    assertEquals(
      (agentState.renave_mock_ultimo as Record<string, unknown>)
        .sensivel_cifrado,
      null,
    );

    const operator = await tryProcessRenaveInbound(
      baseInput(agentState, CPF, { dependencies }) as never,
    );
    assertStringIncludes(operator.reply ?? "", "km atual");
    assertEquals(JSON.stringify(agentState).includes(CPF), false);

    const purchase = await tryProcessRenaveInbound(
      baseInput(
        agentState,
        "km 12000, valor 45000, data hoje",
        { dependencies },
      ) as never,
    );
    assertEquals(
      purchase.interactiveButtons?.buttons.map((button) => button.id),
      [
        "renave_wa:entrada_confirmar:ABC1A23",
        "renave_wa:entrada_corrigir:ABC1A23",
        "renave_wa:entrada_cancelar:ABC1A23",
      ],
    );
    const serializedPending = JSON.stringify(
      agentState.pending_renave_entrada,
    );
    assertEquals(serializedPending.includes(CPF), false);
    assertEquals(serializedPending.includes("98765432101"), false);

    const confirmed = await tryProcessRenaveInbound(
      baseInput(agentState, "Confirmar", {
        interactiveId: "renave_wa:entrada_confirmar:ABC1A23",
        dependencies,
      }) as never,
    );
    assertStringIncludes(confirmed.reply ?? "", "Estoque: 42");
    assertStringIncludes(confirmed.reply ?? "", "confirmar a transferência");
    assertEquals(
      confirmed.interactiveButtons?.buttons.map((button) => button.id),
      [
        "renave_wa:detran:ABC1A23",
        "renave_wa:documentos:ABC1A23",
        "renave_wa:estoque",
      ],
    );
    assertEquals(agentState.pending_renave_entrada, null);
    assertEquals(
      (agentState.renave_mock_ultimo as Record<string, unknown>)
        .sensivel_cifrado,
      null,
    );
    const entryCall = calls.find((call) =>
      call.operacao === "solicitarEntradaEstoque"
    )!;
    const entryVehicle = recordForTest(
      recordForTest(entryCall.body).veiculo,
    );
    assertEquals(entryVehicle.documentoProprietarioAtual, CPF);
    assertEquals(entryVehicle.codigoSegurancaCrv, "98765432101");
    assertEquals(entryVehicle.dataHoraMedicaoHodometro, "2026-11-06T12:00:00");

    const logsText = JSON.stringify(logs);
    assertEquals(logsText.includes(CPF), false);
    assertEquals(logsText.includes("98765432101"), false);
    assertEquals(logsText.includes("ABC1A23"), false);
  } finally {
    console.info = oldInfo;
    restore();
  }
});

function recordForTest(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

Deno.test("RENAVE-2 — veículo não apto encerra antes de pedir compra", async () => {
  const restore = setEnv();
  try {
    const encrypted = await encryptRenaveSensitiveState({
      documentoProprietario: CPF,
      codigoSegurancaCrv: "98765432101",
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
      emailVendedor: "vendedor@exemplo.com.br",
    });
    const agentState: Record<string, unknown> = {
      renave_operador_cifrado: await encryptRenaveOperatorProfile({
        cpfOperadorResponsavel: CPF,
        emailEstabelecimento: "loja@exemplo.com.br",
      }),
      renave_mock_ultimo: {
        ambiente: "hom",
        placa: "ABC1A23",
        renavam: "12345678901",
        numeroCrv: "123456789012",
        tipoCrv: "AZUL",
        sensivel_cifrado: encrypted,
        created_at: NOW.toISOString(),
      },
    };
    const result = await tryProcessRenaveInbound(
      baseInput(agentState, "renave entrada ABC1A23", {
        dependencies: {
          now: () => NOW,
          callRenave: async () => ({
            status: 200,
            body: {
              diagnostico: {
                veiculoApto: false,
                veiculoComRouboFurto: true,
                motivosParaNaoAptidao: ["Roubo ou furto"],
              },
            },
          }),
        },
      }) as never,
    );
    assertStringIncludes(result.reply ?? "", "❌ Não apto");
    assertStringIncludes(result.reply ?? "", "roubo/furto");
    assertEquals(agentState.pending_renave_entrada, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — erro 422 mostra só mensagem final e limpa sensíveis", async () => {
  const restore = setEnv();
  try {
    const encrypted = await encryptRenaveSensitiveState({
      documentoProprietario: CPF,
      codigoSegurancaCrv: "98765432101",
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
      emailVendedor: "vendedor@exemplo.com.br",
    });
    const agentState: Record<string, unknown> = {
      pending_renave_entrada: {
        phase: "confirm",
        placa: "ABC1A23",
        renavam: "12345678901",
        numeroCrv: "123456789012",
        tipoCrv: "AZUL",
        quilometragem: 100,
        valorCompra: 50000,
        dataCompra: "2026-11-06",
        sensivel_cifrado: encrypted,
        expires_at: "2026-11-06T15:15:00Z",
      },
    };
    const result = await tryProcessRenaveInbound(
      baseInput(agentState, "Confirmar", {
        interactiveId: "renave_wa:entrada_confirmar:ABC1A23",
        dependencies: {
          now: () => NOW,
          callRenave: async () => ({
            status: 422,
            body: { mensagemParaUsuarioFinal: "CRV já utilizado" },
          }),
        },
      }) as never,
    );
    assertEquals(result.reply, "CRV já utilizado");
    assertEquals(agentState.pending_renave_entrada, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — cancelar e expirar limpam o estado cifrado", async () => {
  const restore = setEnv();
  try {
    const pending = {
      phase: "compra",
      placa: "ABC1A23",
      sensivel_cifrado: "proc1:cifrado",
      expires_at: "2026-11-06T15:15:00Z",
    };
    const cancelledState: Record<string, unknown> = {
      pending_renave_entrada: pending,
    };
    const cancelled = await tryProcessRenaveInbound(
      baseInput(cancelledState, "cancelar") as never,
    );
    assertStringIncludes(cancelled.reply ?? "", "cancelada");
    assertEquals(cancelledState.pending_renave_entrada, null);

    const expiredState: Record<string, unknown> = {
      pending_renave_entrada: {
        ...pending,
        expires_at: "2026-11-06T14:59:59Z",
      },
    };
    const expired = await tryProcessRenaveInbound(
      baseInput(expiredState, "qualquer texto") as never,
    );
    assertStringIncludes(expired.reply ?? "", "expirou");
    assertEquals(expiredState.pending_renave_entrada, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — pending intercepta texto comum antes do LLM", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      pending_renave_entrada: {
        phase: "crv",
        placa: "ABC1D23",
        expires_at: "2026-11-06T15:15:00Z",
      },
    };
    const result = await tryProcessRenaveInbound(
      baseInput(state, "assunto totalmente diferente") as never,
    );
    assertEquals(result.handled, true);
    assertStringIncludes(result.reply ?? "", "RENAVAM");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-2 — formata restrições e débitos sem inventar dados", () => {
  const result = formatAptitude({
    diagnostico: {
      veiculoApto: false,
      veiculoComRestricaoJudicial: true,
      veiculoComRecall: true,
      motivosParaNaoAptidao: ["Bloqueio"],
    },
    informacoesDebitos: {
      valorDebitoIpva: 100,
      valorDebitoLicenciamento: 50,
      valorDebitoMultas: 25,
    },
  });
  assertEquals(result.apto, false);
  assertStringIncludes(result.reply, "restrição judicial");
  assertStringIncludes(result.reply, "recall");
  assertStringIncludes(result.reply, "IPVA");
});

Deno.test("RENAVE-2 — integração registra prefixo e prioriza pending", async () => {
  const [ids, gestao, processor] = await Promise.all([
    Deno.readTextFile(
      new URL("./whatsapp-interactive-id.ts", import.meta.url),
    ),
    Deno.readTextFile(new URL("./gestao-inbound.ts", import.meta.url)),
    Deno.readTextFile(
      new URL(
        "../whatsapp-cloud-inbound-processor/index.ts",
        import.meta.url,
      ),
    ),
  ]);
  assertStringIncludes(ids, "renave_wa:");
  assert(
    gestao.indexOf("hasPendingRenaveEntry") <
      gestao.indexOf("tryProcessVeiculoProcedenciaInbound({"),
  );
  assert(
    gestao.indexOf("tryProcessRenaveInbound({") >
      gestao.indexOf("tryProcessVeiculoProcedenciaInbound({"),
  );
  assertStringIncludes(
    processor,
    "!(baseState as Record<string, unknown>).pending_renave_entrada",
  );
  assert(
    processor.indexOf("renave_pending: true") <
      processor.indexOf("answerOwnerCommercialStatus(userId, userText)"),
  );
});
