import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoExtratoCsv } from "./gestao-extrato-csv-parse.ts";

Deno.test("parse CSV BR com débito/crédito", () => {
  const csv = `data;descricao;valor;tipo
01/10/2026;Aluguel;2500,00;debito
05/10/2026;Venda PJ;12000,00;credito`;
  const rows = parseGestaoExtratoCsv(csv, { data: 0, descricao: 1, valor: 2, debitoCredito: 3 }, ";");
  assertEquals(rows.length, 2);
  assertEquals(rows[0].sentido, "debito");
  assertEquals(rows[0].valor, 2500);
  assertEquals(rows[1].sentido, "credito");
});
