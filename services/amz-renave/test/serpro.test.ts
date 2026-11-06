import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationPath,
  responseLimitForOperation,
  selectSerproResponseBody,
} from "../src/serpro.js";

test("erro 422 expõe somente mensagem destinada ao usuário final", () => {
  assert.deepEqual(
    selectSerproResponseBody(422, {
      mensagemParaUsuarioFinal: "Veículo não apto",
      detalheInterno: "não expor",
    }),
    { mensagemParaUsuarioFinal: "Veículo não apto" },
  );
});

test("erros 400 e 500 expõem somente campos de rastreabilidade previstos", () => {
  const upstream = {
    titulo: "Falha",
    detalhe: "Requisição inválida",
    logIdRastreabilidade: "log-1",
    stack: "não expor",
  };
  const expected = {
    titulo: "Falha",
    detalhe: "Requisição inválida",
    logIdRastreabilidade: "log-1",
  };
  assert.deepEqual(selectSerproResponseBody(400, upstream), expected);
  assert.deepEqual(selectSerproResponseBody(500, upstream), expected);
});

test("path params são validados, normalizados e codificados", () => {
  const built = buildOperationPath(
    "/api/pdf-atpv/{placa}/{renavam}",
    { placa: "abc1d23", renavam: "12345678901" },
    { placa: "placa", renavam: "renavam" },
  );
  assert.equal(
    built.path,
    "/api/pdf-atpv/ABC1D23/12345678901",
  );
  assert.deepEqual([...built.consumed], ["placa", "renavam"]);

  const stock = buildOperationPath(
    "/api/estoques/{id}",
    { id: 42 },
    { id: "idEstoque" },
  );
  assert.equal(stock.path, "/api/estoques/42");
});

test("path params recusam placa, renavam e estoque inválidos", () => {
  assert.throws(
    () =>
      buildOperationPath(
        "/api/pdf-atpv/{placa}/{renavam}",
        { placa: "../segredo", renavam: "123" },
        { placa: "placa", renavam: "renavam" },
      ),
    /path inválido/,
  );
  assert.throws(
    () =>
      buildOperationPath(
        "/api/estoques/{id}",
        { id: "1/../../2" },
        { id: "idEstoque" },
      ),
    /path inválido/,
  );
});

test("respostas de documentos comportam base64 de PDF até 15 MB", () => {
  assert.equal(responseLimitForOperation("consultarEstoques"), 5 * 1024 * 1024);
  assert.equal(responseLimitForOperation("pdfAtpv"), 22 * 1024 * 1024);
  assert.equal(responseLimitForOperation("termoEntrada"), 22 * 1024 * 1024);
  assert.equal(responseLimitForOperation("termoSaida"), 22 * 1024 * 1024);
  assert.equal(responseLimitForOperation("crlve"), 22 * 1024 * 1024);
});
