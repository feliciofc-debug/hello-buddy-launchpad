import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resetProcedenciaEncKeyCache } from "./procedencia-enc-crypto.ts";
import {
  parseExitDetails,
  parseRenaveCommand,
  tryProcessRenaveInbound,
} from "./renave-inbound.ts";
import {
  encryptRenaveOperatorProfile,
  encryptRenaveSensitiveState,
} from "./renave-state-crypto.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER = "5511999999999";
const NOW = new Date("2026-11-06T15:00:00Z");
const CPF = "52998224725";
const PDF = btoa("%PDF-1.4 test");
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
  callRenave: (call: Record<string, unknown>) => Promise<{
    status: number;
    body: unknown;
  }>,
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
    mensagemId: "wamid-test",
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      Object.assign(current, patch);
      return true;
    },
    dependencies: { now: () => NOW, callRenave },
    ...overrides,
  };
}

function movementDb(rows: Record<string, unknown>[]) {
  return {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        assertEquals(table, "renave_movimentos");
        rows.push(row);
        return { error: null };
      },
    }),
  };
}

Deno.test("RENAVE-3 — parser e dados de saída validam sem expor documento", () => {
  assertEquals(parseRenaveCommand("renave detran ABC1D23")?.kind, "detran");
  assertEquals(parseRenaveCommand("renave saída ABC1D23")?.kind, "saida");
  assertEquals(
    parseRenaveCommand("renave documentos ABC1D23")?.kind,
    "documentos",
  );
  const parsed = parseExitDetails(
    `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Avenida Rio Branco, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60000, data hoje, código 12345678901`,
    NOW,
  );
  assertEquals(parsed?.documento, CPF);
  assertEquals(parsed?.dataVenda, "2026-11-06");
  assertEquals(
    parseExitDetails(
      `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Rua Um, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60.000, data hoje`,
      NOW,
    )?.valorVenda,
    60000,
  );
  assertEquals(
    parseExitDetails(
      `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Rua Um, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60.000,50, data hoje`,
      NOW,
    )?.valorVenda,
    60000.5,
  );
  assertEquals(
    parseExitDetails(
      `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Rua Um, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60000.50, data hoje`,
      NOW,
    )?.valorVenda,
    60000.5,
  );
  assertEquals(
    parseExitDetails(
      "CPF 11111111111, nome X, CEP 1, rua X, número 1, bairro X, cidade X/RJ, valor 1, data hoje",
      NOW,
    ),
    null,
  );
});

Deno.test("RENAVE-3.1 — entrada preserva mensagem e origem que abriram o fluxo", async () => {
  const restore = setEnv();
  const state: Record<string, unknown> = {
    renave_operador_cifrado: await encryptRenaveOperatorProfile({
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
    }),
  };
  try {
    await tryProcessRenaveInbound(
      input(
        state,
        "renave entrada ABC1D23",
        async () => ({ status: 200, body: {} }),
        {
          origem: "audio",
          mensagemId: "wamid-audio-entrada",
        },
      ) as never,
    );
    const pending = state.pending_renave_entrada as Record<string, unknown>;
    assertEquals(pending.origem_pedido, "audio");
    assertEquals(pending.mensagem_pedido_id, "wamid-audio-entrada");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3 — fluxo de saída confirmado envia PDFs e grava origem áudio", async () => {
  const restore = setEnv();
  const state: Record<string, unknown> = {
    renave_operador_cifrado: await encryptRenaveOperatorProfile({
      cpfOperadorResponsavel: CPF,
      emailEstabelecimento: "loja@exemplo.com.br",
    }),
  };
  const movements: Record<string, unknown>[] = [];
  const calls: Record<string, unknown>[] = [];
  try {
    const secret = await encryptRenaveSensitiveState({
      documentoProprietario: "",
      codigoSegurancaCrv: "98765432101",
    });
    state.renave_veiculos = {
      ABC1D23: {
        sensivel_cifrado: secret,
        nf_entrada_enviada: true,
        crv_novo_disponivel: true,
      },
    };
    const callRenave = async (call: Record<string, unknown>) => {
      calls.push(call);
      switch (call.operacao) {
        case "consultarEstoques":
          return {
            status: 200,
            body: [{
              id: 42,
              placa: "ABC1D23",
              renavam: "12345678901",
              numeroCrv: "123456789012",
              estado: "CONFIRMADO",
            }],
          };
        case "municipios":
          return {
            status: 200,
            body: [{ id: 3304557, nome: "Rio de Janeiro", uf: "RJ" }],
          };
        case "solicitarSaidaEstoque":
          return { status: 201, body: { estado: "SOLICITADO" } };
        case "pdfAtpv":
          return { status: 200, body: { pdfAtpvBase64: PDF } };
        default:
          return { status: 200, body: { pdfBase64: PDF } };
      }
    };
    const start = await tryProcessRenaveInbound(
      input(state, "renave saída ABC1D23", callRenave, {
        origem: "audio",
        mensagemId: "wamid-audio-pedido",
      }) as never,
    );
    assertStringIncludes(start.reply ?? "", "CPF/CNPJ");

    const details = await tryProcessRenaveInbound(
      input(
        state,
        `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Avenida Rio Branco, número 10, bairro Centro, cidade Rio de Janeiro/RJ, valor 60000, data hoje`,
        callRenave,
      ) as never,
    );
    const skippedEmail = await tryProcessRenaveInbound(
      input(state, "Pular", callRenave, {
        interactiveId: "renave_wa:saida_email_pular:ABC1D23",
      }) as never,
    );
    const detailsResult = skippedEmail.reply?.includes("Confirma")
      ? skippedEmail
      : details;
    assertEquals(
      detailsResult.interactiveButtons?.buttons[0].id,
      "renave_wa:saida_confirmar:ABC1D23",
    );
    assertEquals(JSON.stringify(state).includes(CPF), false);
    assertEquals(JSON.stringify(state).includes("98765432101"), false);
    assertEquals(JSON.stringify(state).includes("JOAO SILVA"), false);
    assertEquals(JSON.stringify(state).includes("20040020"), false);

    const confirmed = await tryProcessRenaveInbound(
      input(state, "Confirmar", callRenave, {
        interactiveId: "renave_wa:saida_confirmar:ABC1D23",
        origem: "texto",
        mensagemId: "wamid-botao-confirmar",
        sb: movementDb(movements),
      }) as never,
    );
    assertStringIncludes(confirmed.reply ?? "", "Saída solicitada");
    assertEquals(confirmed.documents?.length, 4);
    assertEquals(
      confirmed.interactiveButtons?.buttons.map((button) => button.id),
      ["renave_wa:documentos:ABC1D23", "renave_wa:estoque"],
    );
    assertEquals(state.pending_renave_saida, null);
    assertEquals(
      (state.renave_veiculos as Record<string, Record<string, unknown>>)
        .ABC1D23.sensivel_cifrado,
      null,
    );
    assertEquals(movements[0].origem, "audio");
    assertEquals(movements[0].mensagem_origem_id, "wamid-audio-pedido");
    assertEquals(
      movements[0].mensagem_confirmacao_id,
      "wamid-botao-confirmar",
    );
    assertEquals(movements[0].solicitado_por, "***9999");
    const movementText = JSON.stringify(movements);
    assertEquals(movementText.includes(CPF), false);
    assertEquals(movementText.includes("98765432101"), false);
    const request = calls.find((call) =>
      call.operacao === "solicitarSaidaEstoque"
    );
    assert(request);
    assertEquals(
      JSON.stringify(request).includes("codigoSegurancaCrv"),
      true,
    );
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3 — bloqueia estoque não confirmado e resolve município ambíguo", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_operador_cifrado: await encryptRenaveOperatorProfile({
        cpfOperadorResponsavel: CPF,
        emailEstabelecimento: "loja@exemplo.com.br",
      }),
    };
    const unconfirmed = await tryProcessRenaveInbound(
      input(state, "renave saida ABC1D23", async () => ({
        status: 200,
        body: [{
          id: 42,
          placa: "ABC1D23",
          renavam: "12345678901",
          estado: "SOLICITADO",
        }],
      })) as never,
    );
    assertStringIncludes(unconfirmed.reply ?? "", "não está CONFIRMADO");

    const secret = await encryptRenaveSensitiveState({
      documentoProprietario: "",
      codigoSegurancaCrv: "98765432101",
    });
    state.renave_veiculos = {
      ABC1D23: {
        sensivel_cifrado: secret,
        nf_entrada_enviada: true,
        crv_novo_disponivel: true,
      },
    };
    const caller = async (call: Record<string, unknown>) =>
      call.operacao === "consultarEstoques"
        ? {
          status: 200,
          body: [{
            id: 42,
            placa: "ABC1D23",
            renavam: "12345678901",
            estado: "CONFIRMADO",
          }],
        }
        : {
          status: 200,
          body: [
            { id: 1, nome: "Bom Jesus", uf: "PI" },
            { id: 2, nome: "Bom Jesus", uf: "PI" },
            { id: 3, nome: "Outra Cidade", uf: "PI" },
          ],
        };
    await tryProcessRenaveInbound(
      input(state, "renave saida ABC1D23", caller) as never,
    );
    await tryProcessRenaveInbound(
      input(
        state,
        `CPF ${CPF}, nome JOAO SILVA, CEP 20040020, rua Rua Um, número 10, bairro Centro, cidade Bom Jesus/PI, valor 60000, data hoje`,
        caller,
      ) as never,
    );
    const ambiguous = await tryProcessRenaveInbound(
      input(state, "Pular", caller, {
        interactiveId: "renave_wa:saida_email_pular:ABC1D23",
      }) as never,
    );
    assertStringIncludes(ambiguous.reply ?? "", "mais de um município");
    assertEquals((ambiguous.reply ?? "").includes("Outra Cidade"), false);
    const selected = await tryProcessRenaveInbound(
      input(state, "1", caller) as never,
    );
    assertStringIncludes(selected.reply ?? "", "Confirma a saída");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3 — cancelar, expirar e falhar histórico não quebram o fluxo", async () => {
  const restore = setEnv();
  try {
    const cancelState: Record<string, unknown> = {
      pending_renave_saida: {
        phase: "dados",
        placa: "ABC1D23",
        idEstoque: 42,
        renavam: "12345678901",
        sensivel_cifrado: "proc1:cifrado",
        expires_at: "2026-11-06T15:15:00Z",
      },
    };
    const brokenDb = {
      from: () => ({
        insert: () => Promise.reject(new Error("database unavailable")),
      }),
    };
    const cancelled = await tryProcessRenaveInbound(
      input(cancelState, "cancelar", async () => ({
        status: 200,
        body: {},
      }), { sb: brokenDb }) as never,
    );
    assertStringIncludes(cancelled.reply ?? "", "cancelada");
    assertEquals(cancelState.pending_renave_saida, null);

    const expiredState: Record<string, unknown> = {
      pending_renave_saida: {
        phase: "dados",
        placa: "ABC1D23",
        idEstoque: 42,
        renavam: "12345678901",
        sensivel_cifrado: "proc1:cifrado",
        expires_at: "2026-11-06T14:59:59Z",
      },
    };
    const expired = await tryProcessRenaveInbound(
      input(expiredState, "qualquer assunto", async () => ({
        status: 200,
        body: {},
      })) as never,
    );
    assertStringIncludes(expired.reply ?? "", "expirou");
    assertEquals(expiredState.pending_renave_saida, null);
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.3 — simulação Detran consulta estoque confirmado", async () => {
  const restore = setEnv();
  const state: Record<string, unknown> = {};
  const movements: Record<string, unknown>[] = [];
  try {
    const result = await tryProcessRenaveInbound(
      input(state, "renave detran ABC1D23", async (call) => {
        if (call.operacao === "mockTransferenciaDetran") {
          return { status: 201, body: {} };
        }
        if (call.operacao === "consultarEstoquePorId") {
          return {
            status: 200,
            body: {
              id: 42,
              placa: "ABC1D23",
              renavam: "12345678901",
              numeroCrv: "123456789012",
              estado: "CONFIRMADO",
            },
          };
        }
        return {
          status: 200,
          body: [{
            id: 42,
            placa: "ABC1D23",
            renavam: "12345678901",
            numeroCrv: "123456789012",
            codigoSegurancaCrv: "98765432101",
            estado: "CONFIRMADO",
          }],
        };
      }, { sb: movementDb(movements) }) as never,
    );
    assertStringIncludes(result.reply ?? "", "Detran confirmou");
    assertStringIncludes(result.reply ?? "", "Estado: CONFIRMADO");
    const serialized = JSON.stringify(state);
    assertEquals(serialized.includes("98765432101"), false);
    assertEquals(
      result.interactiveButtons?.buttons[0].id,
      "renave_wa:nota:ABC1D23",
    );
    assertEquals(movements[0].tipo, "detran_simulado");
    assertEquals(movements[0].estado_estoque, "CONFIRMADO");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3 — processor preserva áudio e entrega documentos fora da IA", async () => {
  const [gestao, processor, operationMigration, movementMigration] =
    await Promise.all([
      Deno.readTextFile(new URL("./gestao-inbound.ts", import.meta.url)),
      Deno.readTextFile(
        new URL(
          "../whatsapp-cloud-inbound-processor/index.ts",
          import.meta.url,
        ),
      ),
      Deno.readTextFile(
        new URL(
          "../../migrations/20261106132500_renave_operacoes_r3.sql",
          import.meta.url,
        ),
      ),
      Deno.readTextFile(
        new URL(
          "../../migrations/20261106133000_renave_movimentos.sql",
          import.meta.url,
        ),
      ),
    ]);
  assertStringIncludes(gestao, "origem: input.origem");
  assertStringIncludes(gestao, "mensagemId: input.mensagemId");
  assertStringIncludes(processor, 'origem: "audio"');
  assertStringIncludes(processor, "deliverRenaveDocuments({");
  assertStringIncludes(processor, "sendWhatsAppDocument(");
  assertStringIncludes(processor, "scheduleRenaveDocumentRemoval(");
  assertStringIncludes(processor, "pending_renave_saida");
  assertStringIncludes(
    operationMigration,
    "DROP CONSTRAINT IF EXISTS renave_operacoes_operacao_check",
  );
  assertStringIncludes(operationMigration, "'solicitarSaidaEstoque'");
  assertStringIncludes(
    movementMigration,
    "CREATE TABLE public.renave_movimentos",
  );
  assertStringIncludes(movementMigration, "mensagem_origem_id text");
  assertStringIncludes(movementMigration, "mensagem_confirmacao_id text");
  assertStringIncludes(
    movementMigration,
    "renave_movimentos_message_type_uidx",
  );
  assertStringIncludes(movementMigration, "ENABLE ROW LEVEL SECURITY");
  assertStringIncludes(movementMigration, "user_id = auth.uid()");
  assertEquals(movementMigration.includes("documento_proprietario"), false);
  assertEquals(movementMigration.includes("codigo_seguranca"), false);
});
