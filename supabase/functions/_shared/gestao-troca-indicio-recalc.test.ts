import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gestaoTrocaAchadoRef, recalcIndicioColisaoGestaoTroca } from "./gestao-troca-indicio-recalc.ts";

Deno.test("achado_ref formato", () => {
  assertEquals(gestaoTrocaAchadoRef(7, 2), "f7a2");
});

Deno.test("recalc — descartado remove solda do indício", () => {
  const r = recalcIndicioColisaoGestaoTroca({
    fotos_json: [{
      indice: 1,
      slot_informado: "cofre_longarina_esq",
      slot_identificado: null,
      qualidade_imagem: "boa",
      motivo_qualidade: "",
      descricao: "x",
      achados: [{
        tipo: "solda_aparente",
        local: "longarina",
        severidade: "grave",
        confianca: "alta",
        evidencia: "cordão",
      }],
      nao_da_para_afirmar: [],
    }],
    espessura_json: {},
    itens: [{ achado_ref: "f1a1", decisao: "descartado" }],
  });
  assertEquals(r.dianteira.nivel, "nenhum");
});

Deno.test("recalc — espessura massa registrada na dianteira", () => {
  const r = recalcIndicioColisaoGestaoTroca({
    fotos_json: [],
    espessura_json: { capo: 450 },
    faixas: { original_max: 180, repintura_max: 300 },
  });
  assertEquals(
    r.dianteira.evidencias.some((e) => e.tipo === "espessura_massa"),
    true,
  );
});
