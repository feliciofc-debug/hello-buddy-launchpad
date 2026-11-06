import assert from "node:assert/strict";
import test from "node:test";
import { inspectECnpjPfx } from "../src/certificate.js";
import { generateTestPfx, TEST_CNPJ } from "./helpers.js";

test("PFX e-CNPJ gerado no teste é validado sem persistência", () => {
  const pfx = generateTestPfx();
  try {
    const result = inspectECnpjPfx(pfx, "senha-correta");
    assert.equal(result.cnpj, TEST_CNPJ);
    assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
    assert.ok(new Date(result.validoAte) > new Date());
  } finally {
    pfx.fill(0);
  }
});

test("PFX recusa senha incorreta", () => {
  const pfx = generateTestPfx();
  try {
    assert.throws(
      () => inspectECnpjPfx(pfx, "senha-errada"),
      /PFX inválido ou senha incorreta/,
    );
  } finally {
    pfx.fill(0);
  }
});
