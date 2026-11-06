import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resetProcedenciaEncKeyCache } from "./procedencia-enc-crypto.ts";
import { tryProcessRenaveInbound } from "./renave-inbound.ts";
import {
  encryptRenaveOperatorProfile,
  encryptRenaveSensitiveState,
} from "./renave-state-crypto.ts";

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
  interactiveId: string | null,
  caller: (call: Record<string, unknown>) => Promise<{
    status: number;
    body: unknown;
  }>,
  persisted: { value: Record<string, unknown> },
) {
  return {
    userId: USER_ID,
    fromNumber: OWNER,
    userText: text,
    interactiveId,
    hasInboundMedia: false,
    auth: { ownerPhone: OWNER, ownerAltPhones: [], gestores: [] },
    agentState: state,
    mensagemId: "wamid-r34",
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      // Simula o save real: persiste current+patch sem alterar o objeto recebido.
      persisted.value = { ...current, ...patch };
      return true;
    },
    dependencies: { now: () => NOW, callRenave: caller },
  };
}

function validNfeKey(): string {
  const base = "3526118510603700058555001000000001100000000";
  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index--) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return `${base}${remainder < 2 ? 0 : 11 - remainder}`;
}

Deno.test("RENAVE-3.4 — confirmar entrada não ressuscita pending e Detran executa", async () => {
  const restore = setEnv();
  try {
    const secret = await encryptRenaveSensitiveState({
      documentoProprietario: CPF,
      codigoSegurancaCrv: "98765432101",
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
      emailVendedor: "vendedor@exemplo.com.br",
    });
    const stalePending = {
      phase: "confirm",
      placa: "ABC1D23",
      renavam: "12345678901",
      numeroCrv: "123456789012",
      tipoCrv: "AZUL",
      quilometragem: 45000,
      valorCompra: 60000,
      dataCompra: "2026-11-06",
      sensivel_cifrado: secret,
      expires_at: "2026-11-06T15:15:00Z",
    };
    const state: Record<string, unknown> = {
      pending_renave_entrada: stalePending,
    };
    const persisted = { value: {} as Record<string, unknown> };
    const calls: string[] = [];
    const caller = async (call: Record<string, unknown>) => {
      calls.push(String(call.operacao));
      if (call.operacao === "solicitarEntradaEstoque") {
        return { status: 201, body: { id: 42, estado: "SOLICITADO" } };
      }
      if (call.operacao === "mockTransferenciaDetran") {
        return { status: 201, body: { idEstoque: 42 } };
      }
      if (call.operacao === "consultarEstoquePorId") {
        return {
          status: 200,
          body: {
            id: 42,
            placa: "ABC1D23",
            renavam: "12345678901",
            estado: "CONFIRMADO",
          },
        };
      }
      return { status: 404, body: {} };
    };
    const confirmed = await tryProcessRenaveInbound(
      input(
        state,
        "Confirmar",
        "renave_wa:entrada_confirmar:ABC1D23",
        caller,
        persisted,
      ) as never,
    );
    assertStringIncludes(confirmed.reply ?? "", "Entrada solicitada");
    assertEquals(state.pending_renave_entrada, null);
    assertEquals(persisted.value.pending_renave_entrada, null);

    // Mesmo que um snapshot antigo reapareça, outra ação interativa o supera.
    state.pending_renave_entrada = stalePending;
    const detran = await tryProcessRenaveInbound(
      input(
        state,
        "Simular Detran",
        "renave_wa:detran:ABC1D23",
        caller,
        persisted,
      ) as never,
    );
    assertStringIncludes(detran.reply ?? "", "Detran confirmou");
    assertEquals(calls.includes("mockTransferenciaDetran"), true);
    assertEquals(state.pending_renave_entrada, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.4 — confirmar saída não ressuscita pending", async () => {
  const restore = setEnv();
  try {
    const secret = await encryptRenaveSensitiveState({
      documentoProprietario: CPF,
      codigoSegurancaCrv: "98765432101",
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
      comprador: {
        nome: "JOAO SILVA",
        email: "",
        cep: "20040020",
        logradouro: "Avenida Rio Branco",
        numero: "10",
        bairro: "Centro",
        cidade: "Rio de Janeiro",
        uf: "RJ",
      },
    });
    const stalePending = {
      phase: "confirm",
      placa: "ABC1D23",
      idEstoque: 42,
      renavam: "12345678901",
      numeroCrv: "123456789012",
      codigoMunicipio: 3304557,
      valorVenda: 70000,
      dataVenda: "2026-11-06",
      sensivel_cifrado: secret,
      expires_at: "2026-11-06T15:15:00Z",
    };
    const state: Record<string, unknown> = {
      pending_renave_saida: stalePending,
    };
    const persisted = { value: {} as Record<string, unknown> };
    const caller = async (call: Record<string, unknown>) =>
      call.operacao === "solicitarSaidaEstoque"
        ? { status: 201, body: { estado: "SOLICITADO" } }
        : call.operacao === "consultarEstoques"
        ? { status: 200, body: [] }
        : { status: 404, body: {} };
    await tryProcessRenaveInbound(
      input(
        state,
        "Confirmar",
        "renave_wa:saida_confirmar:ABC1D23",
        caller,
        persisted,
      ) as never,
    );
    assertEquals(state.pending_renave_saida, null);
    assertEquals(persisted.value.pending_renave_saida, null);
    state.pending_renave_saida = stalePending;
    const stock = await tryProcessRenaveInbound(
      input(
        state,
        "Estoque",
        "renave_wa:estoque",
        caller,
        persisted,
      ) as never,
    );
    assertStringIncludes(stock.reply ?? "", "Nenhum veículo");
    assertEquals(state.pending_renave_saida, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.4 — concluir NF não ressuscita pending", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_operador_cifrado: await encryptRenaveOperatorProfile({
        cpfOperadorResponsavel: CPF,
        emailEstabelecimento: "loja@exemplo.com.br",
      }),
      pending_renave_nota: {
        phase: "chave",
        placa: "ABC1D23",
        renavam: "12345678901",
        idEstoque: 42,
        origem_pedido: "texto",
        expires_at: "2026-11-06T15:15:00Z",
      },
    };
    const persisted = { value: {} as Record<string, unknown> };
    const caller = async (call: Record<string, unknown>) => {
      if (call.operacao === "enviarNotaFiscal") {
        return { status: 201, body: {} };
      }
      if (call.operacao === "crlve") {
        return {
          status: 200,
          body: {
            pdfCodigoSegurancaCrvBase64: btoa(
              "%PDF-1.4\nCODIGO 98765432101\n%%EOF",
            ),
          },
        };
      }
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
      return { status: 200, body: {} };
    };
    await tryProcessRenaveInbound(
      input(state, validNfeKey(), null, caller, persisted) as never,
    );
    assertEquals(state.pending_renave_nota, null);
    assertEquals(persisted.value.pending_renave_nota, null);
    state.pending_renave_nota = {
      phase: "chave",
      placa: "ABC1D23",
      renavam: "12345678901",
      idEstoque: 42,
      origem_pedido: "texto",
      expires_at: "2026-11-06T15:15:00Z",
    };
    const exit = await tryProcessRenaveInbound(
      input(
        state,
        "Dar saída",
        "renave_wa:saida:ABC1D23",
        caller,
        persisted,
      ) as never,
    );
    assertStringIncludes(exit.reply ?? "", "CPF/CNPJ do comprador");
    assertEquals(state.pending_renave_nota, null);
  } finally {
    restore();
  }
});
