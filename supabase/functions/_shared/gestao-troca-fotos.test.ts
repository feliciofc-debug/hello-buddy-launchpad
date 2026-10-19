import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalGestaoTrocaEtiqueta,
  gestaoTrocaFotosParaIa,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";

Deno.test("normaliza strings legadas", () => {
  const f = normalizeGestaoTrocaFotos(["u/t/a.jpg"]);
  assertEquals(f[0].path, "u/t/a.jpg");
  assertEquals(f[0].etiqueta, "Lateral esquerda");
});

Deno.test("canonical — traseira e painel", () => {
  assertEquals(canonicalGestaoTrocaEtiqueta("traseira"), "Traseira");
  assertEquals(canonicalGestaoTrocaEtiqueta("painel"), "Painel ligado (km)");
});

Deno.test("normaliza etiqueta legada minúscula", () => {
  const f = normalizeGestaoTrocaFotos([{ path: "u/t/x.jpg", etiqueta: "traseira" }]);
  assertEquals(f[0].etiqueta, "Traseira");
});

Deno.test("IA exclui Documento (CRLV)", () => {
  const f = gestaoTrocaFotosParaIa([
    { path: "a", etiqueta: "Frente" },
    { path: "b", etiqueta: "Documento (CRLV)" },
    { path: "c", etiqueta: "Outra" },
  ]);
  assertEquals(f.map((x) => x.path), ["a", "c"]);
});
