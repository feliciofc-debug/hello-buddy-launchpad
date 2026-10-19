import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseGestaoTrocaIaVisionJson,
  validateGestaoTrocaIaVisionResponse,
} from "./gestao-troca-ia-schema.ts";

Deno.test("schema — aceita resposta válida", () => {
  const r = validateGestaoTrocaIaVisionResponse({
    km_painel: 45200,
    luzes_painel: false,
    aviso_carroceria: false,
    resumo: "Veículo em bom estado geral.",
    itens: [{
      area: "porta_dianteira_esq",
      tipo: "risco",
      gravidade: "leve",
      confianca: "media",
      descricao: "Arranhão leve na porta.",
    }],
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.data.itens.length, 1);
});

Deno.test("schema — rejeita campo extra", () => {
  const r = validateGestaoTrocaIaVisionResponse({
    km_painel: null,
    luzes_painel: null,
    aviso_carroceria: false,
    resumo: "",
    itens: [],
    preco: 1,
  });
  assertEquals(r.ok, false);
});

Deno.test("parse — limpa markdown", () => {
  const raw = '```json\n{"km_painel":null,"luzes_painel":null,"aviso_carroceria":true,"resumo":"x","itens":[]}\n```';
  const r = parseGestaoTrocaIaVisionJson(raw);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.data.aviso_carroceria, true);
});
