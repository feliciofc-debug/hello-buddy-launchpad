import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcGestaoTrocaParecerRecomendacao } from "./gestao-troca-parecer-recomendacao.ts";
import { stubTodasDescricaoAreas } from "./gestao-troca-test-fixtures.ts";

Deno.test("não aceitar — leilão", () => {
  const r = calcGestaoTrocaParecerRecomendacao({
    valor_proposto: 50000,
    valor_sugerido: 52000,
    teto: 60000,
    faixa_verde_min: 48000,
    faixa_verde_max: 55000,
    procedencia_consulta_id: "c1",
    procedencia_resumo: {
      leilao: { possui: true, classificacao: "C", parecer: "x" },
      perda_total: { possui: false, registro: null },
      roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
      gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
      renajud: { possui: false, tipos_restricao: [] },
      veiculo: { marca: "Fiat", modelo: "Argo", ano_fabricacao: 2022, ano_modelo: 2023, cor: null },
      saldo_apos: null,
    },
    alerta_km: false,
    km_painel_conferido: true,
    luzes_painel: false,
    descricao_areas: stubTodasDescricaoAreas(),
    laudo_status: "finalizado",
  });
  assertEquals(r.nivel, "nao_aceitar");
});

Deno.test("não aceitar — proposto acima do teto", () => {
  const r = calcGestaoTrocaParecerRecomendacao({
    valor_proposto: 70000,
    valor_sugerido: 52000,
    teto: 60000,
    faixa_verde_min: 48000,
    faixa_verde_max: 55000,
    procedencia_consulta_id: "c1",
    procedencia_resumo: null,
    alerta_km: false,
    km_painel_conferido: true,
    luzes_painel: false,
    descricao_areas: stubTodasDescricaoAreas(),
    laudo_status: "finalizado",
  });
  assertEquals(r.nivel, "nao_aceitar");
});

Deno.test("negociar — procedência não consultada", () => {
  const r = calcGestaoTrocaParecerRecomendacao({
    valor_proposto: 50000,
    valor_sugerido: 52000,
    teto: 60000,
    faixa_verde_min: 48000,
    faixa_verde_max: 55000,
    procedencia_consulta_id: null,
    procedencia_resumo: null,
    alerta_km: false,
    km_painel_conferido: true,
    luzes_painel: false,
    descricao_areas: stubTodasDescricaoAreas(),
    laudo_status: "finalizado",
  });
  assertEquals(r.nivel, "negociar");
});

Deno.test("aceitar — faixa verde e limpo", () => {
  const r = calcGestaoTrocaParecerRecomendacao({
    valor_proposto: 50000,
    valor_sugerido: 52000,
    teto: 60000,
    faixa_verde_min: 48000,
    faixa_verde_max: 55000,
    procedencia_consulta_id: "c1",
    procedencia_resumo: {
      leilao: { possui: false, classificacao: null, parecer: null },
      perda_total: { possui: false, registro: null },
      roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
      gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
      renajud: { possui: false, tipos_restricao: [] },
      veiculo: { marca: "Fiat", modelo: "Argo", ano_fabricacao: null, ano_modelo: null, cor: null },
      saldo_apos: null,
    },
    alerta_km: false,
    km_painel_conferido: true,
    luzes_painel: false,
    descricao_areas: stubTodasDescricaoAreas(),
    laudo_status: "finalizado",
  });
  assertEquals(r.nivel, "aceitar");
});
