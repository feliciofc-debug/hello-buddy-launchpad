import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resetProcedenciaEncKeyCache } from "./procedencia-enc-crypto.ts";
import {
  extractCrlvSecurityCode,
  generateRenaveMockSuffix,
  parseRenaveCommand,
  tryProcessRenaveInbound,
  validateNfeKey,
} from "./renave-inbound.ts";
import {
  decryptRenaveOperatorProfile,
  decryptRenaveSensitiveState,
  encryptRenaveOperatorProfile,
  encryptRenaveSensitiveState,
} from "./renave-state-crypto.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER = "5511999999999";
const NOW = new Date("2026-11-06T15:00:00Z");
const CPF = "52998224725";
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const CRV_CODE = "98765432101";

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
    mensagemId: "wamid-r33",
    saveAgentStatePatch: async (
      patch: Record<string, unknown>,
      current: Record<string, unknown>,
    ) => {
      Object.assign(current, patch);
      return true;
    },
    dependencies: {
      now: () => NOW,
      loadTenantEmail: async () => "loja@exemplo.com.br",
      callRenave,
    },
    ...overrides,
  };
}

function validNfeKey(): string {
  const base = "3526118510603700058555001000000001100000000";
  assertEquals(base.length, 43);
  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index--) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return `${base}${remainder < 2 ? 0 : 11 - remainder}`;
}

function pdfBase64(content: string): string {
  return btoa(`%PDF-1.4\n${content}\n%%EOF`);
}

Deno.test("RENAVE-3.3 — mock usa UF da loja e entrada guarda operador uma vez", async () => {
  const restore = setEnv();
  const logs: unknown[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => logs.push(args);
  try {
    const state: Record<string, unknown> = {};
    const calls: Record<string, unknown>[] = [];
    const caller = async (call: Record<string, unknown>) => {
      calls.push(call);
      if (call.operacao === "clienteAutenticado") {
        return {
          status: 200,
          body: { endereco: { municipio: { uf: "SP" } } },
        };
      }
      if (call.operacao === "mockVeiculoUsado") {
        const suffix = String(
          (call.body as Record<string, unknown>).sufixoPlaca,
        );
        return {
          status: 201,
          body: {
            placa: `ABC${suffix}`,
            renavam: "12345678901",
            numeroCrv: "123456789012",
            codigoSegurancaCrv: CRV_CODE,
          },
        };
      }
      if (call.operacao === "aptidaoVeiculo") {
        return {
          status: 200,
          body: {
            diagnostico: { veiculoApto: true },
            informacoesDebitos: {},
          },
        };
      }
      if (call.operacao === "solicitarEntradaEstoque") {
        return { status: 201, body: { id: 42, estado: "SOLICITADO" } };
      }
      return { status: 404, body: {} };
    };
    const mock = await tryProcessRenaveInbound(
      input(state, "renave teste", caller) as never,
    );
    const plate = mock.reply?.match(/Placa: ([A-Z0-9]{7})/)?.[1] ?? "";
    const mockCall = calls.find((call) =>
      call.operacao === "mockVeiculoUsado"
    )!;
    assertEquals(
      (mockCall.body as Record<string, unknown>).ufJurisdicaoVeiculo,
      "SP",
    );
    assertMatch(
      String((mockCall.body as Record<string, unknown>).sufixoPlaca),
      /^[0-9][A-J][0-9]{2}$/,
    );
    for (let index = 0; index < 30; index++) {
      assertMatch(generateRenaveMockSuffix(), /^[0-9][A-J][0-9]{2}$/);
    }

    const started = await tryProcessRenaveInbound(
      input(state, `renave entrada ${plate}`, caller) as never,
    );
    assertStringIncludes(started.reply ?? "", "Qual o seu CPF?");
    const operator = await tryProcessRenaveInbound(
      input(state, CPF, caller) as never,
    );
    assertStringIncludes(operator.reply ?? "", "km atual");
    const sealed = String(state.renave_operador_cifrado);
    assertEquals(sealed.includes(CPF), false);
    assertEquals(
      (await decryptRenaveOperatorProfile(sealed)).cpfOperadorResponsavel,
      CPF,
    );

    await tryProcessRenaveInbound(input(state, "45000", caller) as never);
    await tryProcessRenaveInbound(input(state, "60000", caller) as never);
    await tryProcessRenaveInbound(
      input(state, "Hoje", caller, {
        interactiveId: `renave_wa:entrada_data_hoje:${plate}`,
      }) as never,
    );
    await tryProcessRenaveInbound(
      input(state, "Confirmar", caller, {
        interactiveId: `renave_wa:entrada_confirmar:${plate}`,
      }) as never,
    );
    const request = calls.find((call) =>
      call.operacao === "solicitarEntradaEstoque"
    )!;
    const body = request.body as Record<string, unknown>;
    assertEquals(body.cpfOperadorResponsavel, CPF);
    assertEquals(body.emailEstabelecimento, "loja@exemplo.com.br");
    assertEquals(body.emailVendedor, "vendedor.teste@amzofertas.com.br");
    assertEquals(body.dataCompra, "2026-11-06");
    state.renave_mock_ultimo = {
      ambiente: "hom",
      placa: plate,
      renavam: "12345678901",
      numeroCrv: "123456789012",
      tipoCrv: "AZUL",
      sensivel_cifrado: await encryptRenaveSensitiveState({
        documentoProprietario: CPF,
        codigoSegurancaCrv: CRV_CODE,
        emailVendedor: "vendedor.teste@amzofertas.com.br",
      }),
      created_at: NOW.toISOString(),
    };
    const reused = await tryProcessRenaveInbound(
      input(state, `renave entrada ${plate}`, caller) as never,
    );
    assertStringIncludes(reused.reply ?? "", "km atual");
    assertEquals((reused.reply ?? "").includes("Qual o seu CPF?"), false);
    assertEquals(JSON.stringify(logs).includes(CPF), false);
    assertEquals(JSON.stringify(logs).includes(CRV_CODE), false);
  } finally {
    console.info = originalInfo;
    restore();
  }
});

Deno.test("RENAVE-3.3 — e-mail do estabelecimento é pedido e cifrado sem perfil", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_operador_cifrado: await encryptRenaveOperatorProfile({
        cpfOperadorResponsavel: CPF,
      }),
      renave_mock_ultimo: {
        ambiente: "hom",
        placa: "ABC1A23",
        renavam: "12345678901",
        numeroCrv: "123456789012",
        tipoCrv: "AZUL",
        sensivel_cifrado: await encryptRenaveSensitiveState({
          documentoProprietario: CPF,
          codigoSegurancaCrv: CRV_CODE,
          emailVendedor: "vendedor.teste@amzofertas.com.br",
        }),
        created_at: NOW.toISOString(),
      },
    };
    const caller = async () => ({
      status: 200,
      body: {
        diagnostico: { veiculoApto: true },
        informacoesDebitos: {},
      },
    });
    const started = await tryProcessRenaveInbound(
      input(state, "renave entrada ABC1A23", caller, {
        dependencies: {
          now: () => NOW,
          loadTenantEmail: async () => null,
          callRenave: caller,
        },
      }) as never,
    );
    assertStringIncludes(started.reply ?? "", "e-mail do estabelecimento");
    const next = await tryProcessRenaveInbound(
      input(state, "loja@exemplo.com.br", caller) as never,
    );
    assertStringIncludes(next.reply ?? "", "km atual");
    const sealed = String(state.renave_operador_cifrado);
    assertEquals(sealed.includes("loja@exemplo.com.br"), false);
    assertEquals(
      (await decryptRenaveOperatorProfile(sealed)).emailEstabelecimento,
      "loja@exemplo.com.br",
    );
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.3 — NF válida libera CRLV-e, código novo e saída", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_veiculos: {
        ABC1D23: {
          placa: "ABC1D23",
          renavam: "12345678901",
          idEstoque: 42,
          estado: "CONFIRMADO",
          nf_entrada_enviada: false,
          crv_novo_disponivel: false,
        },
      },
    };
    const calls: Record<string, unknown>[] = [];
    const caller = async (call: Record<string, unknown>) => {
      calls.push(call);
      if (call.operacao === "enviarNotaFiscal") {
        return { status: 201, body: {} };
      }
      if (call.operacao === "crlve") {
        return {
          status: 200,
          body: {
            pdfCodigoSegurancaCrvBase64: pdfBase64(
              `CODIGO SEGURANCA ${CRV_CODE}`,
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
            numeroCrv: "123456789012",
            estado: "CONFIRMADO",
          }],
        };
      }
      return { status: 200, body: {} };
    };

    const blocked = await tryProcessRenaveInbound(
      input(state, "renave saída ABC1D23", caller) as never,
    );
    assertStringIncludes(blocked.reply ?? "", "envie a NF-e de entrada");
    assertEquals(
      blocked.interactiveButtons?.buttons[0].id,
      "renave_wa:nota:ABC1D23",
    );
    await tryProcessRenaveInbound(
      input(state, "renave nota ABC1D23", caller) as never,
    );
    const invalid = await tryProcessRenaveInbound(
      input(
        state,
        "12345678901234567890123456789012345678901234",
        caller,
      ) as never,
    );
    assertStringIncludes(invalid.reply ?? "", "inválida");

    const key = validNfeKey();
    assert(validateNfeKey(key));
    const sent = await tryProcessRenaveInbound(
      input(state, key, caller) as never,
    );
    assertEquals(sent.documents?.[0].filename, "crlv-e-ABC1D23.pdf");
    assertStringIncludes(sent.reply ?? "", "código do CRV novo guardado");
    const context = (state.renave_veiculos as Record<
      string,
      Record<string, unknown>
    >).ABC1D23;
    assertEquals(context.nf_entrada_enviada, true);
    assertEquals(context.crv_novo_disponivel, true);
    const secret = await decryptRenaveSensitiveState(
      String(context.sensivel_cifrado),
    );
    assertEquals(secret.codigoSegurancaCrv, CRV_CODE);
    assertEquals(JSON.stringify(state).includes(CRV_CODE), false);
    assertEquals(
      (calls.find((call) => call.operacao === "enviarNotaFiscal")!
        .body as Record<string, unknown>).chaveNotaFiscal,
      key,
    );

    const exit = await tryProcessRenaveInbound(
      input(state, "renave saída ABC1D23", caller) as never,
    );
    assertStringIncludes(exit.reply ?? "", "Qual o seu CPF?");
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.3 — CRLV-e sem código pede os 11 dígitos", async () => {
  const restore = setEnv();
  try {
    const state: Record<string, unknown> = {
      renave_veiculos: {
        ABC1D23: {
          renavam: "12345678901",
          idEstoque: 42,
        },
      },
    };
    const caller = async (call: Record<string, unknown>) =>
      call.operacao === "crlve"
        ? {
          status: 200,
          body: {
            pdfCodigoSegurancaCrvBase64: pdfBase64("SEM CODIGO"),
          },
        }
        : { status: 201, body: {} };
    await tryProcessRenaveInbound(
      input(state, "renave nota ABC1D23", caller) as never,
    );
    const response = await tryProcessRenaveInbound(
      input(state, validNfeKey(), caller) as never,
    );
    assertStringIncludes(response.reply ?? "", "informe os 11 dígitos");
    assertEquals(
      (state.pending_renave_nota as Record<string, unknown>).phase,
      "codigo_crv",
    );
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.3 — extrai código de stream PDF FlateDecode", async () => {
  const source = new TextEncoder().encode(`BT (${CRV_CODE}) Tj ET`);
  const compressed = new Uint8Array(
    await new Response(
      new Blob([source]).stream().pipeThrough(
        new CompressionStream("deflate"),
      ),
    ).arrayBuffer(),
  );
  const prefix = new TextEncoder().encode(
    "%PDF-1.4\n<< /Filter /FlateDecode >>\nstream\n",
  );
  const suffix = new TextEncoder().encode("\nendstream\n%%EOF");
  const pdf = new Uint8Array(prefix.length + compressed.length + suffix.length);
  pdf.set(prefix);
  pdf.set(compressed, prefix.length);
  pdf.set(suffix, prefix.length + compressed.length);
  const base64 = btoa(String.fromCharCode(...pdf));
  assertEquals(await extractCrlvSecurityCode(base64), CRV_CODE);
});

Deno.test("RENAVE-3.3 — erros 422 e 400 do Serpro ficam visíveis", async () => {
  const restore = setEnv();
  try {
    for (
      const [status, body, expected] of [
        [
          422,
          { mensagemParaUsuarioFinal: "Nota já utilizada" },
          "Nota já utilizada",
        ],
        [
          400,
          { detalhe: "evento incompatível" },
          "Serpro (homologação): evento incompatível",
        ],
      ] as const
    ) {
      const state: Record<string, unknown> = {
        renave_veiculos: {
          ABC1D23: { renavam: "12345678901", idEstoque: 42 },
        },
      };
      const caller = async () => ({ status, body });
      await tryProcessRenaveInbound(
        input(state, "renave nota ABC1D23", caller) as never,
      );
      const response = await tryProcessRenaveInbound(
        input(state, validNfeKey(), caller) as never,
      );
      assertEquals(response.reply, expected);
    }
  } finally {
    restore();
  }
});

Deno.test("RENAVE-3.3 — parser reconhece nota e rejeita chave com DV errado", () => {
  assertEquals(parseRenaveCommand("renave nota ABC1D23"), {
    kind: "nota",
    placa: "ABC1D23",
  });
  const key = validNfeKey();
  assertEquals(
    validateNfeKey(`${key.slice(0, -1)}${key.endsWith("0") ? 1 : 0}`),
    false,
  );
});
