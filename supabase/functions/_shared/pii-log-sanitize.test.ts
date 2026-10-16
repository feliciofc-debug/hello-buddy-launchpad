import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertLogRedactionHasNoCpf,
  assertLogSafe,
  redactPiiForLog,
} from "./pii-log-sanitize.ts";

Deno.test("redactPiiForLog remove CPF formatado e email", () => {
  const out = redactPiiForLog(
    "erro cpf=529.982.247-25 email joao@test.com",
  );
  assertEquals(out.includes("529.982.247-25"), false);
  assertEquals(out.includes("joao@test.com"), false);
  assertEquals(out.includes("[CPF]"), true);
});

Deno.test("assertLogSafe falha se log contiver CPF", () => {
  assertThrows(() => assertLogSafe("52998224725"));
  assertThrows(() => assertLogSafe("529.982.247-25"));
  assertLogRedactionHasNoCpf(redactPiiForLog("52998224725"));
});
