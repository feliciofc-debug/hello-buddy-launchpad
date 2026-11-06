import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resetProcedenciaEncKeyCache } from "./procedencia-enc-crypto.ts";
import {
  parseRenaveDate,
  parseRenaveKm,
  parseRenaveMoney,
  tryProcessRenaveInbound,
} from "./renave-inbound.ts";
import { encryptRenaveSensitiveState } from "./renave-state-crypto.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER = "5511999999999";
const NOW = new Date("2026-11-06T15:00:00Z");
const CPF = "52998224725";
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

function setEnv(): () => void {
  const previous = {
    users: Deno.env.get("AMZ_RENAVE_HOM_USER_IDS"),
    environment: Deno.env.get("AMZ_RENAVE_AMBIENTE"),
    key: Deno.env.get("PROCEDENCIA_ENC_KEY"),
  };
  Deno.env.set("AMZ_RENAVE_HOM_USER_IDS", USER_ID);
  Deno.env.set("AMZ_RENAVE_AMBIENTE", "hom");
  Deno.env.set("PROCEDENCIA_ENC_KEY", KEY);
  resetProcedenciaEncKeyCache();
  return () => {
    for (
      const [name, value] of [
        ["AMZ_RENAVE_HOM_USER_IDS", previous.users],
        ["AMZ_RENAVE_AMBIENTE", previous.environment],
        ["PROCEDENCIA_ENC_KEY", previous.key],
      ] as const
    ) {
      if (value == null) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
    resetProcedenciaEncKeyCache();
  };
}

function input(
  state: Record<string, unknown>,
  text: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    userId: USER_ID,
    fromNumber: OWNER,
    userText: text,
    interactiveId: null,
    hasInboundMedia: false,
    auth: { ownerPhone: OWNER, ownerAltPhones: [], gestores: [] },
    agentState: state,
    origem: "texto",
    mensagemId: "wamid-r32",
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      Object.assign(current, patch);
      return true;
    },
    dependencies: {
      now: () => NOW,
      callRenave: async (call: Record<string, unknown>) =>
        call.operacao === "aptidaoVeiculo"
          ? {
            status: 200,
            body: {
              diagnostico: { veiculoApto: true },
              informacoesDebitos: {},
            },
          }
          : { status: 200, body: {} },
    },
    ...overrides,
  };
}

async function mockState(): Promise<Record<string, unknown>> {
  return {
    renave_mock_ultimo: {
      ambiente: "hom",
      placa: "ABC1A23",
      renavam: "12345678901",
      numeroCrv: "123456789012",
      tipoCrv: "AZUL",
      sensivel_cifrado: await encryptRenaveSensitiveState({
        documentoProprietario: CPF,
        codigoSegurancaCrv: "98765432101",
      }),
      created_at: NOW.toISOString(),
    },
  };
}

Deno.test("RENAVE-3.2 — aceita formatos tolerantes de km, valor e data", () => {
  for (const value of ["45000", "45.000", "45 mil", "45000 km", "km 45000"]) {
    assertEquals(parseRenaveKm(value), 45000, value);
  }
  assertEquals(parseRenaveKm("sem quilometragem"), null);
  for (
    const value of [
      "60000",
      "60.000",
      "60.000,50",
      "60 mil",
      "R$ 60.000,00",
    ]
  ) {
    assertEquals(
      parseRenaveMoney(value),
      value === "60.000,50" ? 60000.5 : 60000,
      value,
    );
  }
  for (
    const [value, expected] of [
      ["hoje", "2026-11-06"],
      ["ontem", "2026-11-05"],
      ["06/11/2026", "2026-11-06"],
      ["06/11", "2026-11-06"],
      ["6/11/26", "2026-11-06"],
      ["2026-11-06", "2026-11-06"],
    ]
  ) {
    assertEquals(parseRenaveDate(value, NOW), expected, value);
  }
  assertEquals(parseRenaveDate("07/11/2026", NOW), null);
});

Deno.test("RENAVE-3.2 — menu usa lista e ações carregam a placa", async () => {
  const restore = setEnv();
  try {
    const menu = await tryProcessRenaveInbound(
      input({}, "renave") as never,
    );
    assertEquals(menu.interactiveList?.rows.length, 5);
    assertEquals(
      menu.interactiveList?.rows.map((row) => row.id),
      [
        "renave_wa:menu_teste",
        "renave_wa:menu_estoque",
        "renave_wa:menu_entrada",
        "renave_wa:menu_saida",
        "renave_wa:menu_documentos",
      ],
    );
    const cancelled = await tryProcessRenaveInbound(
      input({}, "Cancelar", {
        interactiveId: "renave_wa:cancelar:ABC1A23",
      }) as never,
    );
    assertEquals(cancelled.reply, "Operação RENAVE cancelada.");

    const state = await mockState();
    const started = await tryProcessRenaveInbound(
      input(state, "renave entrada ABC1A23", {
        origem: "audio",
        mensagemId: "wamid-audio",
      }) as never,
    );
    assertStringIncludes(started.reply ?? "", "km atual");
    assertEquals(
      (state.pending_renave_entrada as Record<string, unknown>).origem_pedido,
      "audio",
    );

    await tryProcessRenaveInbound(input(state, "45.000") as never);
    const date = await tryProcessRenaveInbound(
      input(state, "R$ 60.000,00") as never,
    );
    assertEquals(
      date.interactiveButtons?.buttons.map((button) => button.id),
      [
        "renave_wa:entrada_data_hoje:ABC1A23",
        "renave_wa:entrada_data_ontem:ABC1A23",
        "renave_wa:entrada_data_outra:ABC1A23",
      ],
    );
    const summary = await tryProcessRenaveInbound(
      input(state, "Hoje", {
        interactiveId: "renave_wa:entrada_data_hoje:ABC1A23",
      }) as never,
    );
    assertEquals(
      summary.interactiveButtons?.buttons.map((button) => button.id),
      [
        "renave_wa:entrada_confirmar:ABC1A23",
        "renave_wa:entrada_corrigir:ABC1A23",
        "renave_wa:entrada_cancelar:ABC1A23",
      ],
    );
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.2 — aproveita tudo-em-uma fora de ordem e limita repetição", async () => {
  const restore = setEnv();
  try {
    const state = await mockState();
    await tryProcessRenaveInbound(
      input(state, "renave entrada ABC1A23") as never,
    );
    const summary = await tryProcessRenaveInbound(
      input(state, "data 06/11/2026, valor 60 mil, km 45 mil") as never,
    );
    assertStringIncludes(summary.reply ?? "", "Confirma a entrada");

    const retryState = await mockState();
    await tryProcessRenaveInbound(
      input(retryState, "renave entrada ABC1A23") as never,
    );
    await tryProcessRenaveInbound(input(retryState, "abc") as never);
    await tryProcessRenaveInbound(input(retryState, "def") as never);
    const third = await tryProcessRenaveInbound(
      input(retryState, "inválido") as never,
    );
    assertStringIncludes(third.reply ?? "", "Exemplo:");
    assertEquals(
      third.interactiveButtons?.buttons[0].id,
      "renave_wa:entrada_cancelar:ABC1A23",
    );
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.2 — saída preenche endereço por CEP e segue um campo por vez", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_veiculos: {
        ABC1D23: {
          sensivel_cifrado: await encryptRenaveSensitiveState({
            documentoProprietario: "",
            codigoSegurancaCrv: "98765432101",
          }),
        },
      },
    };
    const callRenave = async (call: Record<string, unknown>) => {
      if (call.operacao === "consultarEstoques") {
        return {
          status: 200,
          body: [{
            id: 42,
            placa: "ABC1D23",
            renavam: "12345678901",
            estado: "CONFIRMADO",
          }],
        };
      }
      if (call.operacao === "municipios") {
        return {
          status: 200,
          body: [{ id: 3304557, nome: "Rio de Janeiro", uf: "RJ" }],
        };
      }
      return { status: 200, body: {} };
    };
    const dependencies = {
      now: () => NOW,
      callRenave,
      fetchViaCep: async () => ({
        cep: "20040020",
        logradouro: "Avenida Rio Branco",
        bairro: "Centro",
        localidade: "Rio de Janeiro",
        uf: "RJ",
      }),
    };
    await tryProcessRenaveInbound(
      input(state, "renave saída ABC1D23", { dependencies }) as never,
    );
    assertStringIncludes(
      (await tryProcessRenaveInbound(
        input(state, CPF, { dependencies }) as never,
      )).reply ?? "",
      "nome",
    );
    assertStringIncludes(
      (await tryProcessRenaveInbound(
        input(state, "João Silva", { dependencies }) as never,
      )).reply ?? "",
      "CEP",
    );
    assertStringIncludes(
      (await tryProcessRenaveInbound(
        input(state, "20040020", { dependencies }) as never,
      )).reply ?? "",
      "número",
    );
    await tryProcessRenaveInbound(
      input(state, "10", { dependencies }) as never,
    );
    const date = await tryProcessRenaveInbound(
      input(state, "60 mil", { dependencies }) as never,
    );
    assertEquals(date.interactiveButtons?.buttons.length, 3);
    const summary = await tryProcessRenaveInbound(
      input(state, "Hoje", {
        interactiveId: "renave_wa:saida_data_hoje:ABC1D23",
        dependencies,
      }) as never,
    );
    assertStringIncludes(summary.reply ?? "", "Confirma a saída");
  } finally {
    restore();
  }
});
