import assert from "node:assert/strict";
import test from "node:test";
import { testKeyring, TEST_CNPJ } from "./helpers.js";

const PFX = Buffer.from("pfx-sintetico");
const PASSWORD = Buffer.from("senha-segura");

test("cofre faz roundtrip de PFX e senha", () => {
  const keyring = testKeyring();
  const sealed = keyring.seal({
    pfx: PFX,
    senha: PASSWORD,
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  const opened = keyring.open(sealed.selado, "loja-a");
  try {
    assert.deepEqual(opened.pfx, PFX);
    assert.deepEqual(opened.senha, PASSWORD);
    assert.equal(opened.cnpj, TEST_CNPJ);
    assert.equal(opened.keyVersion, "v1");
  } finally {
    opened.pfx.fill(0);
    opened.senha.fill(0);
  }
});

test("cofre recusa um byte adulterado", () => {
  const keyring = testKeyring();
  const sealed = keyring.seal({
    pfx: PFX,
    senha: PASSWORD,
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  const envelope = JSON.parse(
    Buffer.from(sealed.selado, "base64").toString("utf8"),
  ) as { pfx: { data: string } };
  const ciphertext = Buffer.from(envelope.pfx.data, "base64");
  ciphertext[0] = (ciphertext[0] ?? 0) ^ 1;
  envelope.pfx.data = ciphertext.toString("base64");
  const tampered = Buffer.from(JSON.stringify(envelope)).toString("base64");
  assert.throws(
    () => keyring.open(tampered, "loja-a"),
    /Não foi possível abrir/,
  );
});

test("cofre vincula o blob à loja pelo AAD", () => {
  const keyring = testKeyring();
  const sealed = keyring.seal({
    pfx: PFX,
    senha: PASSWORD,
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  assert.throws(
    () => keyring.open(sealed.selado, "loja-b"),
    /Não foi possível abrir/,
  );
});

test("cofre recusa chave mestra errada", () => {
  const original = testKeyring("v1", Buffer.alloc(32, 1));
  const wrong = testKeyring("v1", Buffer.alloc(32, 2));
  const sealed = original.seal({
    pfx: PFX,
    senha: PASSWORD,
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  assert.throws(
    () => wrong.open(sealed.selado, "loja-a"),
    /Não foi possível abrir/,
  );
});

test("cofre abre keyVersion anterior durante rotação", () => {
  const oldKey = Buffer.alloc(32, 3);
  const old = testKeyring("v1", oldKey);
  const sealed = old.seal({
    pfx: PFX,
    senha: PASSWORD,
    lojaId: "loja-a",
    cnpj: TEST_CNPJ,
  });
  const rotated = testKeyring("v2", Buffer.alloc(32, 4), oldKey);
  const opened = rotated.open(sealed.selado, "loja-a");
  try {
    assert.deepEqual(opened.pfx, PFX);
    assert.equal(opened.keyVersion, "v1");
  } finally {
    opened.pfx.fill(0);
    opened.senha.fill(0);
  }
});

test("configuração recusa chave mestra com tamanho incorreto", () => {
  assert.throws(
    () => testKeyring("v1", Buffer.alloc(31)),
    /32 bytes/,
  );
});
