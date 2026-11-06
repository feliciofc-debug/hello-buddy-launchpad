import assert from "node:assert/strict";
import test from "node:test";
import { RENAVE_OPERATIONS } from "../src/operations.js";

test("RENAVE-3 registra operações e paths previstos pelo Swagger", () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        "consultarEstoquePorId",
        "solicitarSaidaEstoque",
        "enviarNotaFiscal",
        "pdfAtpv",
        "termoEntrada",
        "termoSaida",
        "crlve",
        "mockTransferenciaDetran",
      ].map((name) => {
        const operation =
          RENAVE_OPERATIONS[name as keyof typeof RENAVE_OPERATIONS];
        return [name, `${operation.method} ${operation.path}`];
      }),
    ),
    {
      consultarEstoquePorId: "GET /api/estoques/{id}",
      solicitarSaidaEstoque: "POST /api/solicitacoes-saida-estoque",
      enviarNotaFiscal: "POST /api/notas-fiscais",
      pdfAtpv: "GET /api/pdf-atpv/{placa}/{renavam}",
      termoEntrada: "GET /api/estoques/{idEstoque}/termo-entrada-estoque",
      termoSaida: "GET /api/estoques/{idEstoque}/termo-saida-estoque",
      crlve: "GET /api/crlve/{placaVeiculo}/{renavamVeiculo}",
      mockTransferenciaDetran:
        "POST /api/veiculos-usados-mock/transferencia-no-detran",
    },
  );
  assert.equal(RENAVE_OPERATIONS.mockTransferenciaDetran.homOnly, true);
});
