"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACCOUNTS,
  buildMetadata,
  buildSql,
  csvField,
  parseArgs,
  sanitize,
  validatePassword,
} = require("./create_accounts.cjs");

test("defines the four canonical account operations", () => {
  assert.deepEqual(
    ACCOUNTS.map(({ tenant, operation, role }) => ({
      tenant,
      operation,
      role,
    })),
    [
      { tenant: "atom", operation: "create", role: "admin" },
      { tenant: "duda", operation: "create", role: "empresa" },
      { tenant: "renata", operation: "create", role: "empresa" },
      { tenant: "marcelo", operation: "update", role: "empresa" },
    ],
  );
});

test("uses only metadata fields read by the live trigger", () => {
  const metadata = buildMetadata(
    { nome: "Duda", whatsapp: "", cpf: "", ignored: "secret" },
    ["cpf", "nome", "whatsapp"],
  );
  assert.deepEqual(metadata, { cpf: "", nome: "Duda", whatsapp: "" });
  assert.equal(Object.hasOwn(metadata, "ignored"), false);
});

test("SQL is transactional, parameter-staged and idempotent", () => {
  const hash = "$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456";
  const rows = ACCOUNTS.map((account, index) => ({
    ...account,
    id:
      account.id ||
      `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
    passwordHash: hash,
    metadata: { nome: account.tenant },
  }));
  const sql = buildSql(rows);

  assert.match(sql, /^(\s*)BEGIN;/);
  assert.match(sql, /COPY account_import/);
  assert.match(sql, /WHERE operation = 'create'\s+AND NOT EXISTS/);
  assert.match(sql, /ON CONFLICT \(user_id, role\) DO NOTHING/);
  assert.match(
    sql,
    /lower\(target\.email\) = lower\(source\.previous_email\)/,
  );
  assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /senha provisória/i);
});

test("CSV quotes metadata and hashes without shell interpolation", () => {
  assert.equal(csvField('a"b'), '"a""b"');
  assert.equal(csvField(null), "");
});

test("redacts hashes from database errors", () => {
  assert.equal(
    sanitize("failed near $2b$10$secret", ["$2b$10$secret"]),
    "failed near [REDACTED]",
  );
});

test("validates password length and bcrypt byte limit", () => {
  assert.throws(() => validatePassword("short", false), /8 caracteres/);
  assert.throws(() => validatePassword("á".repeat(37), false), /72 bytes/);
  assert.doesNotThrow(() => validatePassword("correct horse", false));
  assert.doesNotThrow(() => validatePassword("", true));
});

test("accepts only the export directory argument", () => {
  assert.equal(
    parseArgs(["--export-dir", "/root/export_amz"]).exportDir,
    "/root/export_amz",
  );
  assert.throws(() => parseArgs(["--password", "secret"]), /desconhecido/);
});
