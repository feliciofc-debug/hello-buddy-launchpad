import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoTrocaIaFotoAnaliseJson } from "./gestao-troca-ia-foto-schema.ts";
import { gestaoTrocaKmPainelFromFotoRows } from "./gestao-troca-ia-por-foto.ts";

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

Deno.test("parser foto — a classificar + odômetro → painel_ligado e km", () => {
  const row = parseGestaoTrocaIaFotoAnaliseJson({
    indice: 3,
    slot_informado: "a_classificar",
    slot_identificado: "odometro",
    qualidade_imagem: "boa",
    motivo_qualidade: "",
    descricao: "Painel com odômetro.",
    km_painel: 87432,
    luzes_alerta: [],
    achados: [],
    nao_da_para_afirmar: [],
  }, 5);
  assertEquals(row?.slot_identificado, "painel_ligado");
  assertEquals(row?.km_painel, 87432);
  assertEquals(gestaoTrocaKmPainelFromFotoRows(row ? [row] : []), 87432);
});

Deno.test("parser foto — km ignorado fora de painel", () => {
  const row = parseGestaoTrocaIaFotoAnaliseJson({
    indice: 1,
    slot_informado: "frente",
    slot_identificado: "frente",
    qualidade_imagem: "boa",
    descricao: "Frente.",
    km_painel: 99999,
    luzes_alerta: ["ABS"],
    achados: [],
    nao_da_para_afirmar: [],
  }, 3);
  assertEquals(row?.km_painel, null);
  assertEquals(row?.luzes_alerta, undefined);
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
