import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectWebSearchIntent } from "./jarvis-web-search-intent.ts";

Deno.test("financiamento/juros da loja não dispara busca web", () => {
  assertEquals(detectWebSearchIntent("qual os juros do financiamento?"), null);
});

Deno.test("cupom do mercado com interrogação não dispara fato externo (sem mercado na lista)", () => {
  assertEquals(detectWebSearchIntent("tem cupom do mercado?"), null);
});

Deno.test("dono com texto longo não dispara busca", () => {
  const long = "qual o dolar? ".repeat(80);
  assertEquals(detectWebSearchIntent(long, { ownerMessageOver600: true }), null);
});

Deno.test("pedido explícito de pesquisa ainda funciona", () => {
  const r = detectWebSearchIntent("pesquisa no google cotação do dolar hoje");
  assertEquals(r?.query != null, true);
});
