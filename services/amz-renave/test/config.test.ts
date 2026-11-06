import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const VALID_KEY = Buffer.alloc(32, 9).toString("base64");

test("serviço recusa inicialização sem chave mestra", () => {
  assert.throws(
    () =>
      loadConfig({
        AMZ_RENAVE_TOKEN: "token",
        AMZ_RENAVE_KEY_VERSION: "v1",
      }),
    /AMZ_RENAVE_MASTER_KEY/,
  );
});

test("serviço carrega chave válida e mantém produção desligada por padrão", () => {
  const config = loadConfig({
    AMZ_RENAVE_TOKEN: "token",
    AMZ_RENAVE_KEY_VERSION: "v1",
    AMZ_RENAVE_MASTER_KEY: VALID_KEY,
  });
  assert.equal(config.prodEnabled, false);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3012);
});
