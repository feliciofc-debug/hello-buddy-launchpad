import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoMoneyBr } from "./gestao-money-parse.ts";

Deno.test("parse BRL: inteiros e milhar com ponto", () => {
  assertEquals(parseGestaoMoneyBr("400000"), 400_000);
  assertEquals(parseGestaoMoneyBr("400.000"), 400_000);
  assertEquals(parseGestaoMoneyBr("400.000,00"), 400_000);
  assertEquals(parseGestaoMoneyBr("R$ 400.000,00"), 400_000);
});

Deno.test("parse BRL: decimal vírgula e ponto ambíguo", () => {
  assertEquals(parseGestaoMoneyBr("1.200,50"), 1200.5);
  assertEquals(parseGestaoMoneyBr("1200,50"), 1200.5);
  assertEquals(parseGestaoMoneyBr("850"), 850);
  assertEquals(parseGestaoMoneyBr("1.5"), 1.5);
});

Deno.test("parse BRL: número XLSX", () => {
  assertEquals(parseGestaoMoneyBr(449900), 449_900);
});

Deno.test("parse BRL: vitrine 449.900 não vira 449,9", () => {
  assertEquals(parseGestaoMoneyBr("449.900"), 449_900);
});
