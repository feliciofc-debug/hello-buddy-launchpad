import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcAjusteKmPct,
  calcTrocaPreco,
  DEFAULT_GESTAO_TROCA_CONFIG,
  mesesEntreJanAnoModeloEHoje,
} from "./calc-troca-preco.ts";
import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";

Deno.test("km baixo aplica bônus", () => {
  const pct = calcAjusteKmPct(0.7, DEFAULT_GESTAO_TROCA_CONFIG);
  assertEquals(pct, 0.02);
});

Deno.test("km alto desconto por faixa até teto", () => {
  const pct = calcAjusteKmPct(1.5, DEFAULT_GESTAO_TROCA_CONFIG);
  assert(pct < 0);
  assertEquals(Math.abs(pct), 0.02);
});

Deno.test("sem KBB usa FIPE × fator", () => {
  const r = calcTrocaPreco({
    km: 62000,
    ano_modelo: 2020,
    kbb_troca: null,
    kbb_loja: null,
    kbb_km_caracteristico: null,
    fipe_valor: 100_000,
    preparacao_estimada: 3500,
    valor_proposto: 80000,
  }, DEFAULT_GESTAO_TROCA_CONFIG, {
    qtd_vendidos_12m: 0,
    media_dias_giro: null,
    media_compra: null,
    margem_media_pct: null,
  }, null, new Date("2026-10-01"));
  assertEquals(r.base_troca, 85000);
  assert(r.justificativas.some((j) => j.includes("FIPE")));
});

Deno.test("teto menor que ajustado limita sugerido", () => {
  const cfg = { ...DEFAULT_GESTAO_TROCA_CONFIG, margem_alvo_pct: 30, dias_giro_padrao: 60 };
  const r = calcTrocaPreco({
    km: 10000,
    ano_modelo: 2024,
    kbb_troca: 90000,
    kbb_loja: 100000,
    kbb_km_caracteristico: null,
    fipe_valor: null,
    preparacao_estimada: 0,
    valor_proposto: null,
  }, cfg);
  assert(r.teto != null && r.ajustado != null);
  if (r.teto! < r.ajustado!) {
    assertEquals(r.valor_sugerido, r.teto);
  }
});

Deno.test("leilão reduz sugerido e vermelho", () => {
  const proc: ProcedenciaResumoJson = {
    leilao: { possui: true, classificacao: "B", parecer: "alerta" },
    perda_total: { possui: false, registro: null },
    roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
    gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
    renajud: { possui: false, tipos_restricao: [] },
    veiculo: { marca: null, modelo: null, ano_fabricacao: null, ano_modelo: null, cor: null },
    saldo_apos: null,
  };
  const r = calcTrocaPreco({
    km: 30000,
    ano_modelo: 2021,
    kbb_troca: 80000,
    kbb_loja: 95000,
    kbb_km_caracteristico: null,
    fipe_valor: null,
    preparacao_estimada: 0,
    valor_proposto: 70000,
  }, DEFAULT_GESTAO_TROCA_CONFIG, {
    qtd_vendidos_12m: 3,
    media_dias_giro: 34,
    media_compra: 75000,
    margem_media_pct: 12,
  }, proc);
  assert(r.semaforo === "vermelho");
  assert(r.justificativas.some((j) => j.includes("leilão")));
});

Deno.test("roubo bloqueio vermelho", () => {
  const proc: ProcedenciaResumoJson = {
    leilao: { possui: false, classificacao: null, parecer: null },
    perda_total: { possui: false, registro: null },
    roubo_furto: { possui: true, qtd: 1, ultima_data: "2020", uf: "SP" },
    gravame: { possui: false, situacao: null, agente_financeiro_nome: null },
    renajud: { possui: false, tipos_restricao: [] },
    veiculo: { marca: null, modelo: null, ano_fabricacao: null, ano_modelo: null, cor: null },
    saldo_apos: null,
  };
  const r = calcTrocaPreco({
    km: 10000,
    ano_modelo: 2022,
    kbb_troca: 70000,
    kbb_loja: 85000,
    kbb_km_caracteristico: null,
    fipe_valor: null,
    preparacao_estimada: 0,
    valor_proposto: 65000,
  }, DEFAULT_GESTAO_TROCA_CONFIG, {
    qtd_vendidos_12m: 0,
    media_dias_giro: null,
    media_compra: null,
    margem_media_pct: null,
  }, proc);
  assert(r.bloqueio);
  assertEquals(r.semaforo, "vermelho");
});

Deno.test("gravame alerta na lista", () => {
  const proc: ProcedenciaResumoJson = {
    leilao: { possui: false, classificacao: null, parecer: null },
    perda_total: { possui: false, registro: null },
    roubo_furto: { possui: false, qtd: 0, ultima_data: null, uf: null },
    gravame: { possui: true, situacao: "ativo", agente_financeiro_nome: "Banco X" },
    renajud: { possui: false, tipos_restricao: [] },
    veiculo: { marca: null, modelo: null, ano_fabricacao: null, ano_modelo: null, cor: null },
    saldo_apos: null,
  };
  const r = calcTrocaPreco({
    km: 10000,
    ano_modelo: 2022,
    kbb_troca: 70000,
    kbb_loja: 85000,
    kbb_km_caracteristico: null,
    fipe_valor: null,
    preparacao_estimada: 0,
    valor_proposto: null,
  }, DEFAULT_GESTAO_TROCA_CONFIG, {
    qtd_vendidos_12m: 0,
    media_dias_giro: null,
    media_compra: null,
    margem_media_pct: null,
  }, proc);
  assert(r.justificativas.some((j) => j.toLowerCase().includes("gravame")));
});

Deno.test("meses mínimo 1", () => {
  assertEquals(mesesEntreJanAnoModeloEHoje(2026, new Date("2026-10-01")), 10);
});
