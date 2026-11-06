import assert from "node:assert/strict";
import test from "node:test";
import { redactForLog } from "../src/redaction.js";

test("redaction remove segredos, documentos e mascara placa", () => {
  const value = redactForLog({
    requestId: "req-1",
    placa: "ABC1D23",
    detalhe: "veículo ABC1D23 do documento 85106037000585",
    senha: "segredo",
    token: "token-secreto",
    nested: { pfxBase64: "bytes-secretos", codigoSegurancaCrv: "123" },
  });
  assert.deepEqual(value, {
    requestId: "req-1",
    placa: "ABC****",
    detalhe: "veículo ABC**** do documento [REDACTED]",
    senha: "[REDACTED]",
    token: "[REDACTED]",
    nested: {
      pfxBase64: "[REDACTED]",
      codigoSegurancaCrv: "[REDACTED]",
    },
  });
});
