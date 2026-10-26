import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyMolicarProcedencia,
  constantTimeSecretEqual,
  molicarJobId,
  molicarProcedenciaPath,
  sanitizeMolicarProcedencia,
} from "./molicar-procedencia.ts";

Deno.test("MOLICAR-2 usa somente os endpoints assíncronos oficiais", () => {
  assertEquals(
    molicarProcedenciaPath("debts", "plate", "ABC1D23"),
    "/api/v1/plate/ABC1D23/debts",
  );
  assertEquals(
    molicarProcedenciaPath("gravame", "vin", "9BWZZZ377VT004251"),
    "/api/v1/vin/9BWZZZ377VT004251/gravame",
  );
  assertEquals(
    molicarProcedenciaPath("renajud", "plate", "ABC1D23", "job/1"),
    "/api/v1/plate/ABC1D23/renajud/job%2F1",
  );
  assertThrows(
    () => molicarProcedenciaPath("debts", "vin", "VIN", "job"),
    Error,
    "não documenta polling",
  );
  assertThrows(
    () => molicarProcedenciaPath("renajud", "vin", "VIN"),
    Error,
    "só possui endpoint oficial por placa",
  );
});

Deno.test("MOLICAR-2 classifica status documentados e extrai JobId", () => {
  assertEquals(
    classifyMolicarProcedencia(202, { Status: "PROCESSING" }),
    "pending",
  );
  assertEquals(
    classifyMolicarProcedencia(200, { Status: "SUCCESS" }),
    "completed",
  );
  assertEquals(
    classifyMolicarProcedencia(200, { Status: "RESOURCE_NOT_FOUND" }),
    "completed",
  );
  assertEquals(
    classifyMolicarProcedencia(422, { Status: "UNPROCESSABLE_ENTITY" }),
    "error",
  );
  assertEquals(
    classifyMolicarProcedencia(200, {
      Status: 422,
      Code: "UNPROCESSABLE_ENTITY",
    }),
    "error",
  );
  assertEquals(
    classifyMolicarProcedencia(410, { Status: "REQUEST_EXPIRED" }),
    "expired",
  );
  assertEquals(molicarJobId({ Data: { JobId: "job-123" } }), "job-123");
});

Deno.test("MOLICAR-2 sanitiza PII recursiva e preserva agente operacional", () => {
  const clean = sanitizeMolicarProcedencia({
    Gravame: [{
      FinancedName: "Pessoa",
      FinancedDocumentNumber: "123",
      ProprietaryDocumentType: "CPF",
      AgentName: "Banco Seguro",
      AgentCnpj: "00.000.000/0001-00",
      ContractNumber: "C-1",
    }],
    Owner: {
      Name: "Outra Pessoa",
      Document: "456",
      Address: "Rua privada",
      Status: "regular",
    },
  }) as Record<string, unknown>;
  const text = JSON.stringify(clean);
  assert(!text.includes("Pessoa"));
  assert(!text.includes('"456"'));
  assert(text.includes("Banco Seguro"));
  assert(text.includes("00.000.000/0001-00"));
  assert(text.includes("ContractNumber"));
  assert(text.includes('"Status":"regular"'));
});

Deno.test("MOLICAR-2 segredo de webhook usa comparação completa", () => {
  assertEquals(constantTimeSecretEqual("segredo", "segredo"), true);
  assertEquals(constantTimeSecretEqual("segredo", "segredx"), false);
  assertEquals(constantTimeSecretEqual("curto", "muito-maior"), false);
});

Deno.test("MOLICAR-2 quota/refund idempotente e permissões são estáticos", async () => {
  const migration = await Deno.readTextFile(
    new URL(
      "../../migrations/20261032281000_molicar_procedencia_async.sql",
      import.meta.url,
    ),
  );
  assert(migration.includes("public.molicar_consumir_quota(p_user_id)"));
  assert(migration.includes("WHERE id = p_id FOR UPDATE"));
  assert(migration.includes("v_row.status <> 'pendente'"));
  assert(migration.includes("greatest(q.usado - 1, 0)"));
  assert(migration.includes("public.molicar_devolver_quota("));
  assert(migration.includes("v_row.quota_competencia"));
  assert(
    migration.includes(
      "REVOKE ALL ON public.molicar_procedencia FROM anon, authenticated",
    ),
  );
  assert(
    migration.includes(
      "GRANT SELECT ON public.molicar_procedencia TO authenticated",
    ),
  );
  assert(migration.includes("USING (user_id = auth.uid())"));
  assert(
    migration.includes(
      "GRANT EXECUTE ON FUNCTION public.molicar_procedencia_finalizar",
    ),
  );
  assert(migration.includes("'molicar-procedencia-poll',"));
  assert(migration.includes("'x-cron-secret', v_key"));
});

Deno.test("MOLICAR-2 autentica webhook antes de processar o body", async () => {
  const webhook = await Deno.readTextFile(
    new URL("../molicar-procedencia-webhook/index.ts", import.meta.url),
  );
  assert(
    webhook.indexOf("constantTimeSecretEqual") < webhook.indexOf("req.json()"),
  );
  assert(webhook.includes('req.headers.get("X-Molicar-Webhook-Key")'));
  assert(webhook.includes('req.headers.get("X-JobId")'));

  const config = await Deno.readTextFile(
    new URL("../../config.toml", import.meta.url),
  );
  assert(config.includes("[functions.molicar-procedencia]"));
  assert(config.includes("[functions.molicar-procedencia-webhook]"));
  assert(config.includes("[functions.molicar-procedencia-poll]"));
});

Deno.test("MOLICAR-2 registra API key do webhook no formato oficial", async () => {
  const source = await Deno.readTextFile(
    new URL("molicar-procedencia.ts", import.meta.url),
  );
  assert(source.includes('Type: "API_KEY"'));
  assert(source.includes('HeaderName: "X-Molicar-Webhook-Key"'));
  assert(source.includes("HeaderValue: apiKey"));
});
