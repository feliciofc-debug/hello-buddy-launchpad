import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalGestaoTrocaEtiqueta,
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  gestaoTrocaFotosParaIa,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";

Deno.test("normaliza strings legadas — a classificar (sem índice)", () => {
  const f = normalizeGestaoTrocaFotos(["u/t/a.jpg"]);
  assertEquals(f[0].path, "u/t/a.jpg");
  assertEquals(f[0].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR);
});

Deno.test("canonical — traseira e painel", () => {
  assertEquals(canonicalGestaoTrocaEtiqueta("traseira"), "Traseira");
  assertEquals(canonicalGestaoTrocaEtiqueta("painel"), "Painel ligado (km)");
});

Deno.test("normaliza etiqueta legada minúscula (escolha manual)", () => {
  const f = normalizeGestaoTrocaFotos([{ path: "u/t/x.jpg", etiqueta: "traseira", slot_origem: "usuario", slot: "traseira" }]);
  assertEquals(f[0].etiqueta, "Traseira");
  assertEquals(f[0].slot, "traseira");
});

Deno.test("legado por índice vira a classificar + origem ia", () => {
  const f = normalizeGestaoTrocaFotos([
    { path: "a", etiqueta: "Lateral esquerda" },
    { path: "b", etiqueta: "Frente" },
    { path: "c", etiqueta: "Traseira" },
    { path: "d", etiqueta: "Lateral direita" },
    { path: "e", etiqueta: "Painel ligado (km)" },
  ]);
  assertEquals(f[0].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR);
  assertEquals(f[4].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR);
  assertEquals(f[4].slot_origem, "ia");
});

Deno.test("IA exclui Documento (CRLV)", () => {
  const f = gestaoTrocaFotosParaIa([
    { path: "a", etiqueta: "Frente", slot: "frente", slot_origem: "usuario" },
    { path: "b", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
    { path: "c", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR },
  ]);
  assertEquals(f.map((x) => x.path), ["a", "c"]);
});
