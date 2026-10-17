import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";

Deno.test("intent venda raio-x", () => {
  const i = classifyGestaoIntent("Como foi a venda do X6?");
  assertEquals(i.kind, "venda_raiox");
});

Deno.test("intent piores negocios do mes", () => {
  const i = classifyGestaoIntent("piores negocios do mes");
  assertEquals(i.kind, "piores_negocios_mes");
});
