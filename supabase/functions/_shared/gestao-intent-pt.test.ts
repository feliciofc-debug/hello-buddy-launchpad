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

Deno.test("intent revogar link contador", () => {
  const i = classifyGestaoIntent("cancela o link do contador");
  assertEquals(i.kind, "revogar_link_contador");
});

Deno.test("intent emite nota veiculo", () => {
  const i = classifyGestaoIntent("emite a nota do X6");
  assertEquals(i.kind, "nfe_emit");
});

Deno.test("intent notas do mes", () => {
  const i = classifyGestaoIntent("notas do mes");
  assertEquals(i.kind, "notas_mes");
});

Deno.test("intent posicao loja frases dono", () => {
  assertEquals(classifyGestaoIntent("como está a loja?").kind, "posicao_loja");
  assertEquals(classifyGestaoIntent("posição da loja").kind, "posicao_loja");
  assertEquals(classifyGestaoIntent("resumo do dia").kind, "posicao_loja");
  assertEquals(classifyGestaoIntent("como estamos").kind, "posicao_loja");
});

Deno.test("intent posicao loja nao captura preco cliente", () => {
  assertEquals(classifyGestaoIntent("qual o preço do carro?").kind, "none");
});

Deno.test("intent relatorio vendedores", () => {
  assertEquals(classifyGestaoIntent("relatório dos vendedores").kind, "relatorio_vendedores");
  assertEquals(
    classifyGestaoIntent("como estão as vendas dos vendedores").kind,
    "relatorio_vendedores",
  );
});

Deno.test("intent vendedor detalhe", () => {
  const i = classifyGestaoIntent("como está a Ana?");
  assertEquals(i.kind, "vendedor_detalhe");
  assertEquals(i.vendedorHint.toLowerCase(), "ana");
});
