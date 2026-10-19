import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertGestaoTrocaTransicao,
} from "./gestao-troca-status.ts";

Deno.test("transições válidas", () => {
  assertEquals(
    assertGestaoTrocaTransicao("em_avaliacao", "solicitar_aprovacao"),
    "aguardando_aprovacao",
  );
  assertEquals(
    assertGestaoTrocaTransicao("aguardando_aprovacao", "aprovar"),
    "aprovada",
  );
  assertEquals(assertGestaoTrocaTransicao("aprovada", "fechar"), "fechada");
});

Deno.test("transição inválida bloqueada", () => {
  let err = "";
  try {
    assertGestaoTrocaTransicao("fechada", "aprovar");
  } catch (e) {
    err = (e as Error).message;
  }
  assertEquals(err.includes("aprovar"), true);
});
