import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assignExtratoDedupeOccurrences,
  dedupeKeyFromHash,
  hashExtratoDedupe,
} from "./gestao-extrato-dedupe.ts";

Deno.test("duas tarifas iguais no mesmo dia geram ocorrências distintas", () => {
  const linhas = assignExtratoDedupeOccurrences([
    { data: "2026-04-01", descricao: "TARIFA", valor: 12.9, sentido: "debito", fitid: null },
    { data: "2026-04-01", descricao: "TARIFA", valor: 12.9, sentido: "debito", fitid: null },
  ]);
  assertEquals(linhas[0].dedupeOccurrence, 0);
  assertEquals(linhas[1].dedupeOccurrence, 1);
  const h = hashExtratoDedupe("2026-04-01", "TARIFA", 12.9, "debito");
  assertEquals(dedupeKeyFromHash("u1", h, 0), dedupeKeyFromHash("u1", h, 0));
  assertEquals(dedupeKeyFromHash("u1", h, 0) !== dedupeKeyFromHash("u1", h, 1), true);
});

Deno.test("reimportação usa mesmas chaves por ordem do arquivo", () => {
  const base = [
    { data: "2026-04-01", descricao: "TARIFA", valor: 12.9, sentido: "debito", fitid: null },
    { data: "2026-04-01", descricao: "TARIFA", valor: 12.9, sentido: "debito", fitid: null },
  ];
  const a = assignExtratoDedupeOccurrences(base);
  const b = assignExtratoDedupeOccurrences(base);
  const uid = "user-x";
  const keysA = a.map((l) => {
    const h = hashExtratoDedupe(l.data, l.descricao, l.valor, l.sentido);
    return dedupeKeyFromHash(uid, h, l.dedupeOccurrence);
  });
  const keysB = b.map((l) => {
    const h = hashExtratoDedupe(l.data, l.descricao, l.valor, l.sentido);
    return dedupeKeyFromHash(uid, h, l.dedupeOccurrence);
  });
  assertEquals(keysA, keysB);
});
