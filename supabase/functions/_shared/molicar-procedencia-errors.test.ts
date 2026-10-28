import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyProcedenciaStartFailure } from "./molicar-procedencia-errors.ts";
import { MolicarDailyLimitError } from "./molicar-service.ts";

Deno.test("PROC-1 — classifica falhas antes do insert com mensagens úteis", () => {
  assertEquals(
    classifyProcedenciaStartFailure(new MolicarDailyLimitError()).reason,
    "quota_diaria",
  );
  assertEquals(
    classifyProcedenciaStartFailure(new Error("Conecte a Molicar antes de consultar."))
      .reason,
    "molicar_nao_conectada",
  );
  assertEquals(
    classifyProcedenciaStartFailure(new Error(
      "Configure MOLICAR_PROCEDENCIA_WEBHOOK_URL HTTPS e MOLICAR_PROCEDENCIA_WEBHOOK_SECRET.",
    )).reason,
    "webhook_env_ausente",
  );
  assertEquals(
    classifyProcedenciaStartFailure(new Error("Teto do mês atingido (30/30)"))
      .reason,
    "quota_mensal",
  );
});
