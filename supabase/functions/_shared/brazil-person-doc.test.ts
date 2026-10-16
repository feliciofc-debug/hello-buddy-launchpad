import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidCnpj, isValidCpf } from "./brazil-person-doc.ts";

Deno.test("CPF válido conhecido", () => {
  assert(isValidCpf("529.982.247-25"));
  assert(isValidCpf("52998224725"));
});

Deno.test("CPF inválido", () => {
  assertFalse(isValidCpf("111.111.111-11"));
  assertFalse(isValidCpf("123"));
});

Deno.test("CNPJ válido conhecido", () => {
  assert(isValidCnpj("04.252.011/0001-10"));
});
