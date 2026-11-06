import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { RenaveConfig } from "../src/config.js";
import type { SerproCall } from "../src/serpro.js";
import { createRenaveServer } from "../src/server.js";
import { generateTestPfx, testKeyring, TEST_CNPJ } from "./helpers.js";

const TOKEN = "token-de-teste";

function config(prodEnabled = false): RenaveConfig {
  return {
    token: TOKEN,
    keyring: testKeyring(),
    prodEnabled,
    host: "127.0.0.1",
    port: 3012,
  };
}

async function withServer(
  prodEnabled: boolean,
  call: (input: SerproCall) => Promise<{ status: number; body: unknown }>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createRenaveServer(config(prodEnabled), { callSerpro: call });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

function post(baseUrl: string, path: string, body: unknown, token = TOKEN) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RENAVE-Token": token,
    },
    body: JSON.stringify(body),
  });
}

test("token inválido recebe 401", async () => {
  await withServer(false, async () => ({ status: 200, body: {} }), async (url) => {
    const response = await post(
      url,
      "/renave/chamar",
      { ambiente: "hom", operacao: "clienteAutenticado", params: {} },
      "errado",
    );
    assert.equal(response.status, 401);
  });
});

test("whitelist rejeita operação desconhecida", async (context) => {
  context.mock.method(console, "info", () => undefined);
  let called = false;
  await withServer(false, async () => {
    called = true;
    return { status: 200, body: {} };
  }, async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "hom",
      operacao: "excluirTudo",
      params: {},
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

test("produção fica bloqueada sem a flag explícita", async (context) => {
  context.mock.method(console, "info", () => undefined);
  await withServer(false, async () => ({ status: 200, body: {} }), async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "prod",
      operacao: "clienteAutenticado",
      params: {},
    });
    assert.equal(response.status, 403);
  });
});

test("mockVeiculoUsado nunca pode ser chamado em produção", async (context) => {
  context.mock.method(console, "info", () => undefined);
  await withServer(true, async () => ({ status: 200, body: {} }), async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "prod",
      operacao: "mockVeiculoUsado",
      params: {},
    });
    assert.equal(response.status, 400);
  });
});

test("mockTransferenciaDetran também é bloqueado em produção", async (context) => {
  context.mock.method(console, "info", () => undefined);
  await withServer(true, async () => ({ status: 201, body: {} }), async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "prod",
      operacao: "mockTransferenciaDetran",
      params: {},
      body: { placa: "ABC1D23" },
    });
    assert.equal(response.status, 400);
  });
});

test("path params inválidos são rejeitados antes da chamada Serpro", async (context) => {
  context.mock.method(console, "info", () => undefined);
  let called = false;
  await withServer(false, async () => {
    called = true;
    return { status: 200, body: {} };
  }, async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "hom",
      operacao: "pdfAtpv",
      params: { placa: "../segredo", renavam: "123" },
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
});

test("homologação chama apenas a operação mapeada sem certificado", async (context) => {
  context.mock.method(console, "info", () => undefined);
  let received: SerproCall | undefined;
  await withServer(false, async (input) => {
    received = input;
    return { status: 200, body: { cliente: "hom" } };
  }, async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "hom",
      operacao: "clienteAutenticado",
      params: {},
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 200,
      body: { cliente: "hom" },
    });
  });
  assert.equal(received?.ambiente, "hom");
  assert.equal(received?.operacao, "clienteAutenticado");
  assert.equal(received?.certificate, undefined);
});

test("solicitação de entrada usa a nova operação POST da whitelist", async (context) => {
  context.mock.method(console, "info", () => undefined);
  let received: SerproCall | undefined;
  const entryBody = {
    dataCompra: "2026-11-06",
    valorCompra: 50_000,
    veiculo: {
      placa: "ABC1D23",
      renavam: "12345678901",
      numeroCrv: "123456789012",
      codigoSegurancaCrv: "12345678901",
      tipoCrv: "AZUL",
      quilometragemHodometro: 10_000,
      dataHoraMedicaoHodometro: "2026-11-06T12:00:00",
      documentoProprietarioAtual: "52998224725",
      tipoDocumentoProprietarioAtual: "CPF",
    },
  };
  await withServer(false, async (input) => {
    received = input;
    return { status: 201, body: { id: 42, estado: "SOLICITADO" } };
  }, async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "hom",
      operacao: "solicitarEntradaEstoque",
      params: {},
      body: entryBody,
    });
    assert.deepEqual(await response.json(), {
      status: 201,
      body: { id: 42, estado: "SOLICITADO" },
    });
  });
  assert.equal(received?.operacao, "solicitarEntradaEstoque");
  assert.deepEqual(received?.body, entryBody);
});

test("produção abre o certificado só durante a chamada e zera buffers", async (context) => {
  context.mock.method(console, "info", () => undefined);
  const keyring = testKeyring();
  const sealed = keyring.seal({
    pfx: Buffer.from("pfx-em-memoria"),
    senha: Buffer.from("senha-em-memoria"),
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  let pfxUsed: Buffer | undefined;
  await withServer(true, async (input) => {
    pfxUsed = input.certificate?.pfx;
    assert.equal(input.certificate?.passphrase, "senha-em-memoria");
    assert.equal(input.certificate?.pfx.toString(), "pfx-em-memoria");
    return { status: 200, body: { ok: true } };
  }, async (url) => {
    const response = await post(url, "/renave/chamar", {
      ambiente: "prod",
      operacao: "clienteAutenticado",
      params: {},
      lojaId: "loja-a",
      selado: sealed.selado,
    });
    assert.equal(response.status, 200);
  });
  assert.ok(pfxUsed);
  assert.equal(pfxUsed.every((byte) => byte === 0), true);
});

test("selar devolve somente envelope e metadados públicos", async () => {
  const pfx = generateTestPfx();
  try {
    await withServer(false, async () => ({ status: 200, body: {} }), async (url) => {
      const response = await post(url, "/certificados/selar", {
        pfxBase64: pfx.toString("base64"),
        senha: "senha-correta",
        lojaId: "loja-a",
      });
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(body).sort(), [
        "cnpj",
        "fingerprint",
        "keyVersion",
        "selado",
        "validoAte",
      ]);
      assert.equal(body.cnpj, TEST_CNPJ);
      assert.equal(body.keyVersion, "v1");
    });
  } finally {
    pfx.fill(0);
  }
});
