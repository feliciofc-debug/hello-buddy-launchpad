import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveBackPath } from "./app-back-nav.ts";

Deno.test("resolveBackPath aceita caminho interno", () => {
  assertEquals(resolveBackPath("/gestao/lucro", null, "/dashboard"), "/gestao/lucro");
});

Deno.test("resolveBackPath rejeita protocol-relative e URL absoluta", () => {
  assertEquals(resolveBackPath("//evil.com", null, "/dashboard"), "/dashboard");
  assertEquals(resolveBackPath("https://evil.com", null, "/dashboard"), "/dashboard");
  assertEquals(resolveBackPath("/ok", "//x", "/dashboard"), "/ok");
});

Deno.test("resolveBackPath usa state.from quando param inválido", () => {
  assertEquals(
    resolveBackPath(null, "/gestao/lucro?aba=notas", "/dashboard"),
    "/gestao/lucro?aba=notas",
  );
});
