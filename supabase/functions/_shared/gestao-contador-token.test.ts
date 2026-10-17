import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateGestaoContadorToken, hashGestaoContadorToken } from "./gestao-contador-token.ts";

Deno.test("hash token é determinístico", async () => {
  const h1 = await hashGestaoContadorToken("abc");
  const h2 = await hashGestaoContadorToken("abc");
  assertEquals(h1, h2);
  assertEquals(h1.length, 64);
});

Deno.test("gera token longo", () => {
  assertEquals(generateGestaoContadorToken().length >= 32, true);
});
