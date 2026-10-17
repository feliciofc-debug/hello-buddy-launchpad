import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { matchExtratoComCandidatos, statusFromSugestoes } from "./gestao-conciliacao-match.ts";

Deno.test("match automático valor e data", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e1", data: "2026-04-10", descricao: "ALUGUEL", valor: 3000, sentido: "debito" },
    [{
      tipo: "conta_pagar",
      refId: "c1",
      data: "2026-04-10",
      valor: 3000,
      descricao: "Aluguel loja",
      liquidado: false,
    }],
  );
  assertEquals(sug.length, 1);
  assertEquals(sug[0].auto, true);
  assertEquals(statusFromSugestoes(sug), "conciliado");
});

Deno.test("duas opções vira confirmar", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e1", data: "2026-04-10", descricao: "PGTO", valor: 500, sentido: "debito" },
    [
      { tipo: "conta_pagar", refId: "a", data: "2026-04-09", valor: 500, descricao: "x", liquidado: false },
      { tipo: "conta_pagar", refId: "b", data: "2026-04-11", valor: 500, descricao: "y", liquidado: false },
    ],
  );
  assertEquals(sug[0].auto, false);
  assertEquals(statusFromSugestoes(sug), "confirmar");
});
