#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const ACCOUNTS = [
  {
    tenant: "atom",
    email: "expo@atombrasildigital.com",
    role: "admin",
    operation: "create",
  },
  {
    tenant: "duda",
    email: "dudacarega@gmail.com",
    role: "empresa",
    operation: "create",
  },
  {
    tenant: "renata",
    email: "renatascarega@gmail.com",
    role: "empresa",
    operation: "create",
  },
  {
    tenant: "marcelo",
    email: "marcelo.martins@autorizadoademicon.com.br",
    previousEmail: "marcelo@ademicon.local",
    id: "22f0c364-a782-48fa-8482-0ed3d7529a5f",
    role: "empresa",
    operation: "update",
  },
];

const DEFAULT_EXPORT_DIR = "/root/export_amz";
const BCRYPT_PATH = "/opt/amz-auth/node_modules/bcryptjs";
const PSQL_ARGS = [
  "exec",
  "-i",
  "amz-postgres",
  "psql",
  "-X",
  "-q",
  "-A",
  "-t",
  "-F",
  "|",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "supabase_admin",
  "-d",
  "amz",
];

function parseArgs(argv) {
  let exportDir = DEFAULT_EXPORT_DIR;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--export-dir" && argv[index + 1]) {
      exportDir = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`argumento desconhecido: ${argv[index]}`);
    }
  }
  return { exportDir };
}

function sanitize(text, secrets) {
  return secrets.reduce(
    (result, secret) =>
      secret ? result.split(secret).join("[REDACTED]") : result,
    String(text),
  );
}

function runPsql(sql, secrets = []) {
  const result = spawnSync("docker", PSQL_ARGS, {
    input: sql,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error) {
    throw new Error(`falha ao executar docker/psql: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const message = sanitize(result.stderr || result.stdout, secrets).trim();
    throw new Error(`psql recusou a operação: ${message || "erro sem detalhes"}`);
  }
  return result.stdout.trim();
}

function inspectHandleNewUser() {
  const output = runPsql(`
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
SELECT '__TRIGGER_COUNT__=' || count(*)::text
FROM pg_trigger trigger
WHERE trigger.tgrelid = 'auth.users'::regclass
  AND trigger.tgfoid = 'public.handle_new_user()'::regprocedure
  AND NOT trigger.tgisinternal
  AND trigger.tgenabled <> 'D'
  AND (trigger.tgtype & 1) = 1
  AND (trigger.tgtype & 2) = 0
  AND (trigger.tgtype & 4) = 4;
`);
  const marker = "\n__TRIGGER_COUNT__=";
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) {
    throw new Error("não foi possível auditar o trigger handle_new_user");
  }
  const definition = output.slice(0, markerIndex);
  const triggerCount = Number(output.slice(markerIndex + marker.length).trim());
  if (triggerCount !== 1 || !definition.includes("raw_user_meta_data")) {
    throw new Error(
      "handle_new_user diverge do contrato esperado; nenhuma conta foi alterada",
    );
  }

  const metadataKeys = new Set();
  const keyPattern = /raw_user_meta_data\s*->>\s*'([^']+)'/gi;
  for (const match of definition.matchAll(keyPattern)) {
    metadataKeys.add(match[1]);
  }
  if (!metadataKeys.has("nome")) {
    throw new Error(
      "handle_new_user não lê metadata.nome; revise a função antes de criar contas",
    );
  }
  return [...metadataKeys].sort();
}

function readProfile(exportDir, tenant) {
  const profilePath = path.join(exportDir, tenant, "profiles.json");
  const payload = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const records = Array.isArray(payload) ? payload : payload.data;
  if (!Array.isArray(records) || records.length !== 1) {
    throw new Error(`${profilePath} deve conter exatamente um perfil`);
  }
  return records[0];
}

function buildMetadata(profile, metadataKeys) {
  return Object.fromEntries(
    metadataKeys.map((key) => [key, profile[key] ?? ""]),
  );
}

function readHidden(prompt) {
  let tty;
  try {
    tty = fs.openSync("/dev/tty", "r+");
  } catch {
    throw new Error("um terminal interativo é obrigatório para ler as senhas");
  }

  const stty = (...args) =>
    spawnSync("stty", ["-F", "/dev/tty", ...args], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  const bytes = [];
  const byte = Buffer.alloc(1);
  fs.writeSync(tty, prompt);
  const disabled = stty("-echo");
  if (disabled.status !== 0) {
    fs.closeSync(tty);
    throw new Error("não foi possível ocultar a entrada da senha");
  }
  const restoreEcho = () => stty("echo");
  const onInterrupt = () => {
    restoreEcho();
    process.exit(130);
  };
  process.once("SIGINT", onInterrupt);
  try {
    while (fs.readSync(tty, byte, 0, 1) === 1) {
      if (byte[0] === 10 || byte[0] === 13) break;
      if (byte[0] === 3) throw new Error("operação cancelada");
      bytes.push(byte[0]);
    }
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    restoreEcho();
    fs.writeSync(tty, "\n");
    fs.closeSync(tty);
  }
  return Buffer.from(bytes).toString("utf8");
}

function validatePassword(password, allowEmpty) {
  if (!password && allowEmpty) return;
  if (password.length < 8) {
    throw new Error("a senha deve ter pelo menos 8 caracteres");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("a senha não pode ultrapassar 72 bytes em UTF-8");
  }
}

function promptPassword(label, allowEmpty = false) {
  const suffix = allowEmpty ? " (Enter preserva a atual)" : "";
  const first = readHidden(`Senha provisória de ${label}${suffix}: `);
  validatePassword(first, allowEmpty);
  if (!first && allowEmpty) return null;
  const confirmation = readHidden(`Repita a senha de ${label}: `);
  if (first !== confirmation) {
    throw new Error(`as senhas de ${label} não coincidem`);
  }
  return first;
}

function csvField(value) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvField).join(",");
}

function buildSql(rows) {
  const copyRows = rows
    .map((row) =>
      csvRow([
        row.tenant,
        row.operation,
        row.id,
        row.email,
        row.previousEmail,
        row.passwordHash,
        JSON.stringify(row.metadata),
        row.role,
      ]),
    )
    .join("\n");

  return `
BEGIN;
LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE account_import (
  tenant text NOT NULL,
  operation text NOT NULL,
  planned_id uuid NOT NULL,
  email text NOT NULL,
  previous_email text,
  password_hash text,
  metadata jsonb NOT NULL,
  account_role text NOT NULL
) ON COMMIT DROP;

COPY account_import (
  tenant, operation, planned_id, email, previous_email,
  password_hash, metadata, account_role
) FROM STDIN WITH (FORMAT csv);
${copyRows}
\\.

DO $guard$
DECLARE
  marcelo account_import%ROWTYPE;
  candidate account_import%ROWTYPE;
  existing_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO STRICT marcelo
  FROM account_import
  WHERE tenant = 'marcelo';

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = marcelo.planned_id
      AND lower(email) IN (lower(marcelo.previous_email), lower(marcelo.email))
  ) THEN
    RAISE EXCEPTION
      'conta do Marcelo não encontrada no UUID e e-mails esperados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(marcelo.email)
      AND id <> marcelo.planned_id
  ) THEN
    RAISE EXCEPTION
      'novo e-mail do Marcelo já pertence a outro UUID';
  END IF;

  FOR candidate IN
    SELECT * FROM account_import WHERE operation = 'create'
  LOOP
    SELECT * INTO existing_user
    FROM auth.users
    WHERE lower(email) = lower(candidate.email);

    IF FOUND AND (
      existing_user.email_confirmed_at IS NULL
      OR COALESCE(existing_user.encrypted_password, '') !~ '^\\$2[aby]\\$10\\$'
      OR existing_user.id IN (
        'b7af0118-c506-4f87-8ac3-a0a11fd621fe'::uuid,
        '684ed635-2a72-47ba-bee1-a8c906d973a3'::uuid,
        '781d6839-0de1-4261-a971-4375ee8db92d'::uuid
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = existing_user.id
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = existing_user.id
          AND role = candidate.account_role::public.app_role
      )
    ) THEN
      RAISE EXCEPTION
        'e-mail % já existe, mas não corresponde a uma conta canônica completa',
        candidate.email;
    END IF;
  END LOOP;
END;
$guard$;

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
)
SELECT
  planned_id,
  email,
  password_hash,
  now(),
  now(),
  now(),
  metadata
FROM account_import source
WHERE operation = 'create'
  AND NOT EXISTS (
    SELECT 1 FROM auth.users existing
    WHERE lower(existing.email) = lower(source.email)
  );

UPDATE auth.users target
SET email = source.email,
    encrypted_password = COALESCE(source.password_hash, target.encrypted_password),
    updated_at = now()
FROM account_import source
WHERE source.operation = 'update'
  AND target.id = source.planned_id
  AND lower(target.email) = lower(source.previous_email);

INSERT INTO public.user_roles (user_id, role)
SELECT users.id, source.account_role::public.app_role
FROM account_import source
JOIN auth.users users ON lower(users.email) = lower(source.email)
ON CONFLICT (user_id, role) DO NOTHING;

DO $validate$
BEGIN
  IF (
    SELECT count(*)
    FROM account_import source
    JOIN auth.users users ON lower(users.email) = lower(source.email)
    JOIN public.profiles profiles ON profiles.id = users.id
    JOIN public.user_roles roles
      ON roles.user_id = users.id
     AND roles.role = source.account_role::public.app_role
    WHERE users.email_confirmed_at IS NOT NULL
      AND users.encrypted_password ~ '^\\$2[aby]\\$[0-9]{2}\\$'
      AND (
        source.tenant <> 'marcelo'
        OR users.id = source.planned_id
      )
  ) <> 4 THEN
    RAISE EXCEPTION
      'validação final das quatro contas falhou; transação revertida';
  END IF;
END;
$validate$;

SELECT source.tenant, users.id::text, users.email, source.account_role
FROM account_import source
JOIN auth.users users ON lower(users.email) = lower(source.email)
ORDER BY CASE source.tenant
  WHEN 'atom' THEN 1
  WHEN 'duda' THEN 2
  WHEN 'renata' THEN 3
  WHEN 'marcelo' THEN 4
END;

COMMIT;
`;
}

async function main() {
  const { exportDir } = parseArgs(process.argv.slice(2));
  const bcrypt = require(BCRYPT_PATH);
  const metadataKeys = inspectHandleNewUser();

  const profiles = Object.fromEntries(
    ACCOUNTS.filter((account) => account.operation === "create").map(
      (account) => [account.tenant, readProfile(exportDir, account.tenant)],
    ),
  );

  console.log(
    `handle_new_user conferido; metadata utilizada: ${metadataKeys.join(", ")}`,
  );
  console.log("Nenhuma senha ou hash será exibido.");

  const rows = [];
  const hashes = [];
  for (const account of ACCOUNTS) {
    const password = promptPassword(
      account.email,
      account.operation === "update",
    );
    const passwordHash =
      password === null ? null : await bcrypt.hash(password, 10);
    if (
      passwordHash &&
      (!/^\$2[aby]\$10\$/.test(passwordHash) ||
        !(await bcrypt.compare(password, passwordHash)))
    ) {
      throw new Error(`bcrypt incompatível para ${account.email}`);
    }
    if (passwordHash) hashes.push(passwordHash);
    rows.push({
      ...account,
      id: account.id || randomUUID(),
      passwordHash,
      metadata:
        account.operation === "create"
          ? buildMetadata(profiles[account.tenant], metadataKeys)
          : {},
    });
  }

  const output = runPsql(buildSql(rows), hashes);
  const resultLines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (resultLines.length !== ACCOUNTS.length) {
    throw new Error(
      `esperadas ${ACCOUNTS.length} contas no resultado; recebidas ${resultLines.length}`,
    );
  }

  console.log("\nUUIDs canônicos:");
  for (const [index, line] of resultLines.entries()) {
    const [tenant, id, email, role] = line.split("|");
    const expected = ACCOUNTS[index];
    if (
      tenant !== expected.tenant ||
      email.toLowerCase() !== expected.email ||
      role !== expected.role ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new Error("resultado final do PostgreSQL não corresponde ao plano");
    }
    console.log(`${tenant.padEnd(8)} ${id}  ${email}  ${role}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`ERRO: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ACCOUNTS,
  buildMetadata,
  buildSql,
  csvField,
  parseArgs,
  sanitize,
  validatePassword,
};
