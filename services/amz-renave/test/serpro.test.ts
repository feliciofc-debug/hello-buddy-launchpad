import assert from "node:assert/strict";
import test from "node:test";
import { selectSerproResponseBody } from "../src/serpro.js";

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
