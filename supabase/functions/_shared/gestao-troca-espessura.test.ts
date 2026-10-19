import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classificarEspessuraUm } from "./gestao-troca-espessura.ts";

Deno.test("espessura 180 original", () => {
  assertEquals(classificarEspessuraUm(180), "original");
});

Deno.test("espessura 181 repintura", () => {
  assertEquals(classificarEspessuraUm(181), "repintura");
});

Deno.test("espessura 300 repintura", () => {
  assertEquals(classificarEspessuraUm(300), "repintura");
});

Deno.test("espessura 301 massa", () => {
  assertEquals(classificarEspessuraUm(301), "massa");
});

Deno.test("espessura vazio", () => {
  assertEquals(classificarEspessuraUm(null), "nao_medido");
});
