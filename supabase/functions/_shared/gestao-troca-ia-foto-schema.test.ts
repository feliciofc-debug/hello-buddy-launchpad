import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoTrocaIaFotoAnaliseJson } from "./gestao-troca-ia-foto-schema.ts";

Deno.test("parser foto — rejeita tipo fora do enum", () => {
  const row = parseGestaoTrocaIaFotoAnaliseJson({
    indice: 1,
    slot_informado: "frente",
    qualidade_imagem: "boa",
    descricao: "ok",
    achados: [{ tipo: "tipo_invalido", local: "x", severidade: "leve", confianca: "media", evidencia: "y" }],
    nao_da_para_afirmar: [],
  }, 5);
  assertEquals(row?.achados.length, 0);
});

Deno.test("parser foto — rejeita índice inexistente", () => {
  const row = parseGestaoTrocaIaFotoAnaliseJson({
    indice: 9,
    slot_informado: "frente",
    qualidade_imagem: "boa",
    descricao: "ok",
    achados: [],
    nao_da_para_afirmar: [],
  }, 5);
  assertEquals(row, null);
});
