import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseGestaoTrocaIaVisionJson,
  validateGestaoTrocaIaVisionResponse,
} from "./gestao-troca-ia-schema.ts";
import { stubVisionJson } from "./gestao-troca-test-fixtures.ts";

Deno.test("schema — aceita resposta válida", () => {
  const r = validateGestaoTrocaIaVisionResponse(stubVisionJson({
    km_painel: 45200,
    luzes_painel: false,
    itens: [{
      area: "porta_dianteira_esq",
      tipo: "risco",
      gravidade: "leve",
      confianca: "media",
      descricao: "Arranhão leve na porta.",
      foto_indice: 1,
    }],
  }), 3);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.data.itens.length, 1);
});

Deno.test("schema — rejeita campo extra", () => {
  const r = validateGestaoTrocaIaVisionResponse(stubVisionJson({ preco: 1 }), 1);
  assertEquals(r.ok, false);
});

Deno.test("parse — limpa markdown", () => {
  const raw = '```json\n' + JSON.stringify(stubVisionJson({ aviso_carroceria: true, resumo: "x" })) + '\n```';
  const r = parseGestaoTrocaIaVisionJson(raw, 1);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.data.aviso_carroceria, true);
});
