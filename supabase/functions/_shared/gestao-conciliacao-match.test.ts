import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  atribuirAutoMatchesGreedy,
  matchExtratoComCandidatos,
  statusFromSugestoes,
} from "./gestao-conciliacao-match.ts";

Deno.test("match automático valor data e descrição aluguel", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e1", data: "2026-04-10", descricao: "ALUGUEL LOJA", valor: 3000, sentido: "debito" },
    [{
      tipo: "conta_pagar",
      refId: "c1",
      data: "2026-04-10",
      valor: 3000,
      descricao: "Aluguel loja",
      liquidado: false,
      categoria: "aluguel",
    }],
  );
  assertEquals(sug.length, 1);
  assertEquals(sug[0].auto, true);
  assertEquals(statusFromSugestoes(sug), "conciliado");
});

Deno.test("conta já paga manualmente continua candidata", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e1", data: "2026-04-10", descricao: "PAG ALUGUEL", valor: 3000, sentido: "debito" },
    [{
      tipo: "conta_pagar",
      refId: "c1",
      data: "2026-04-10",
      valor: 3000,
      descricao: "Aluguel",
      liquidado: true,
      categoria: "aluguel",
    }],
  );
  assertEquals(sug.length, 1);
  assertEquals(sug[0].auto, true);
});

Deno.test("duas opções na janela vira confirmar", () => {
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

Deno.test("valor igual data +2 dias sem descrição não auto", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e1", data: "2026-04-10", descricao: "PIX GENÉRICO", valor: 500, sentido: "debito" },
    [{
      tipo: "conta_pagar",
      refId: "c1",
      data: "2026-04-12",
      valor: 500,
      descricao: "Fornecedor XYZ",
      liquidado: false,
      categoria: "outros",
    }],
  );
  assertEquals(sug.length, 1);
  assertEquals(sug[0].auto, false);
});

Deno.test("dois PIX 500 e uma conta: greedy concilia só um", () => {
  const candidato = {
    tipo: "conta_pagar" as const,
    refId: "c1",
    data: "2026-04-10",
    valor: 500,
    descricao: "Conta única",
    liquidado: false,
    categoria: "outros",
  };
  const e1 = matchExtratoComCandidatos(
    { id: "ex1", data: "2026-04-10", descricao: "Conta única pgto", valor: 500, sentido: "debito" },
    [candidato],
  );
  const e2 = matchExtratoComCandidatos(
    { id: "ex2", data: "2026-04-10", descricao: "Conta única pgto", valor: 500, sentido: "debito" },
    [candidato],
  );
  const atrib = atribuirAutoMatchesGreedy([
    { id: "ex1", data: "2026-04-10", valor: 500, sugestoes: e1 },
    { id: "ex2", data: "2026-04-10", valor: 500, sugestoes: e2 },
  ]);
  assertEquals(atrib.length, 1);
});

Deno.test("candidato já vinculado é excluído das sugestões", () => {
  const sug = matchExtratoComCandidatos(
    { id: "e2", data: "2026-04-10", descricao: "PIX", valor: 500, sentido: "debito" },
    [{
      tipo: "conta_pagar",
      refId: "c1",
      data: "2026-04-10",
      valor: 500,
      descricao: "Conta",
      liquidado: false,
    }],
    { refsOcupados: new Set(["conta_pagar:c1"]) },
  );
  assertEquals(sug.length, 0);
});
