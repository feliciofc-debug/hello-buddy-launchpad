import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fundoPedidoNoTexto,
  normalizarProps,
  PALETA_PADRAO,
} from "./video-motion.ts";

Deno.test("mapeia fundo branco para claro", () => {
  assertEquals(fundoPedidoNoTexto("Faça um vídeo institucional com fundo branco"), "claro");
});

Deno.test("mapeia fundo preto para escuro", () => {
  assertEquals(fundoPedidoNoTexto("Quero a animação com fundo preto"), "escuro");
});

Deno.test("sem pedido de fundo mantém o padrão", () => {
  assertEquals(fundoPedidoNoTexto("Faça um vídeo institucional"), null);
  const props = normalizarProps({}, { marca: "Minha marca", arranjo: 1 });
  assertEquals(props.fundo, undefined);
  assertEquals(props.cores, PALETA_PADRAO);
});

Deno.test("normalização preserva fundo explícito", () => {
  assertEquals(normalizarProps({ fundo: "claro" }, { marca: "Minha marca", arranjo: 1 }).fundo, "claro");
  assertEquals(normalizarProps({ fundo: "escuro" }, { marca: "Minha marca", arranjo: 1 }).fundo, "escuro");
});
