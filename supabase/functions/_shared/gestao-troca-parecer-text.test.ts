import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parecerTextoSemNumerosInventados } from "./gestao-troca-parecer-text.ts";

Deno.test("parecer rejeita número inventado", () => {
  const ok = parecerTextoSemNumerosInventados(
    "Proposta de R$ 50.000 está adequada.",
    [50000, 52000],
  );
  assertEquals(ok, true);
  const bad = parecerTextoSemNumerosInventados(
    "Sugerimos R$ 99.999 para fechar.",
    [50000],
  );
  assertEquals(bad, false);
});
