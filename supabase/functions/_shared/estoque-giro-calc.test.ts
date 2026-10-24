import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";
import {
  baseIpvaEstoqueGiro,
  calcularEstoqueGiro,
  DEFAULT_ESTOQUE_GIRO_CONFIG,
  diasEmEstoque,
  escolherReferenciaRepasse,
  faixaEstoqueGiro,
  isTemporadaIpvaVirada,
} from "./estoque-giro-calc.ts";

const config = {
  ...DEFAULT_ESTOQUE_GIRO_CONFIG,
  custoFinanceiroMensalPct: 1.5,
  desvalorizacaoMensalPct: 1,
  repasseDescontoFipePct: 10,
  uf: "SP",
  ipvaAliquotaPct: 4,
};

Deno.test("G90-1 — dias usa data de compra e fallback created_at", () => {
  assertEquals(diasEmEstoque("2026-10-23", "2026-08-24", "2020-01-01"), 60);
  assertEquals(diasEmEstoque("2026-10-23", null, "2026-09-23"), 30);
});

Deno.test("G90-1 — faixas obedecem limites configuráveis", () => {
  assertEquals(faixaEstoqueGiro(29, config), "saudavel");
  assertEquals(faixaEstoqueGiro(30, config), "atencao");
  assertEquals(faixaEstoqueGiro(60, config), "risco");
  assertEquals(faixaEstoqueGiro(90, config), "decisao");
});

Deno.test("G90-1 — Molicar B2B tem prioridade sobre FIPE", () => {
  assertEquals(
    escolherReferenciaRepasse([
      { fonte: "fipe", valor: 100_000 },
      { fonte: "molicar_b2b", valor: 88_000 },
    ])?.valor,
    88_000,
  );
});

Deno.test("G90-1.1 — manual fica entre Molicar B2B e FIPE", () => {
  assertEquals(
    escolherReferenciaRepasse([
      { fonte: "fipe", valor: 100_000 },
      { fonte: "manual", valor: 92_000 },
    ])?.fonte,
    "manual",
  );
  assertEquals(
    escolherReferenciaRepasse([
      { fonte: "manual", valor: 92_000 },
      { fonte: "molicar_b2b", valor: 88_000 },
    ])?.fonte,
    "molicar_b2b",
  );
});

Deno.test("G90-1 — calcula custo, comissão, projeção e risco sem inventar leads", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-08-24",
    createdAt: "2026-08-24",
    valorCompra: 80_000,
    despesas: [1_000, 500],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.diasEmEstoque, 60);
  assertEquals(r.faixa, "risco");
  assertEquals(r.custoAtual, 83_900);
  assertEquals(r.valorRepasseHoje, 90_000);
  assert(r.margemVarejoHoje != null && r.margemVarejo30d != null);
  assert(r.custoDeEsperar30d != null && r.custoDeEsperar30d > 0);
  assert(r.indiceRisco >= 0 && r.indiceRisco <= 100);
  assert(r.indiceSemDado.includes("procura/leads"));
});

Deno.test("G90-1 — IPVA só entra se virada cair nos próximos 30 dias", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-12-15",
    dataCompra: "2026-10-01",
    createdAt: "2026-10-01",
    valorCompra: 80_000,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config: { ...config, ipvaLojaPagaVirada: true },
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.ipvaProjetado, 4_000);
});

Deno.test("G90-1.1 — IPVA na virada visível a partir de outubro", () => {
  assert(isTemporadaIpvaVirada("2026-09-30") === false);
  assert(isTemporadaIpvaVirada("2026-10-01"));
  const r = calcularEstoqueGiro({
    hoje: "2026-10-15",
    dataCompra: "2026-08-01",
    createdAt: "2026-08-01",
    valorCompra: 80_000,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config: { ...config, ipvaLojaPagaVirada: true },
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.ipvaViradaValor, 4_000);
  assert(r.ipvaViradaDiasRestantes != null && r.ipvaViradaDiasRestantes > 0);
  assertEquals(r.ipvaProjetado, 0);
});

Deno.test("G90-1.1 — sem FIPE ainda calcula varejo e não bloqueia", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-09-01",
    createdAt: "2026-09-01",
    valorCompra: 70_000,
    despesas: [],
    precoAnunciado: 95_000,
    referencias: [],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.dadosIncompletos, []);
  assert(r.margemVarejoHoje != null);
  assertEquals(r.valorRepasseHoje, null);
  assert(r.recomendacao !== "Completar dados antes de decidir");
});

Deno.test("G90-1.1 — carro saudável nunca recebe priorizar repasse", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-10-17",
    createdAt: "2026-10-17",
    valorCompra: 80_000,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.faixa, "saudavel");
  assert(!r.recomendacao.toLowerCase().includes("repasse"));
});

Deno.test("G90-1.1 — preço sugerido respeita piso custo + comissão", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-08-24",
    createdAt: "2026-08-24",
    valorCompra: 95_000,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.faixa, "risco");
  if (r.precoSugerido7d != null && r.custoAtual != null && r.comissaoEstimada != null) {
    assert(r.precoSugerido7d >= r.custoAtual + r.comissaoEstimada - 0.01);
  }
});

Deno.test("G90-1.2 — repasse pior que esperar não é priorizado", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-08-24",
    createdAt: "2026-08-24",
    valorCompra: 95_000,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [
      { fonte: "fipe", valor: 100_000 },
      { fonte: "manual", valor: 96_000 },
    ],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.faixa, "risco");
  assert(!r.recomendacao.includes("Priorizar repasse"));
  assertEquals(r.recomendacao, "Decidir com o dono");
  assert(r.porque.includes("Repasse hoje:"));
});

Deno.test("G90-1.2 — IPVA usa FIPE mesmo com repasse manual", () => {
  assertEquals(
    baseIpvaEstoqueGiro([
      { fonte: "manual", valor: 70_000 },
      { fonte: "fipe", valor: 100_000 },
    ], 95_000).valor,
    100_000,
  );
  const r = calcularEstoqueGiro({
    hoje: "2026-10-15",
    dataCompra: "2026-08-01",
    createdAt: "2026-08-01",
    valorCompra: 80_000,
    despesas: [],
    precoAnunciado: 95_000,
    referencias: [
      { fonte: "manual", valor: 70_000 },
      { fonte: "fipe", valor: 100_000 },
    ],
    config: { ...config, ipvaLojaPagaVirada: true },
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.ipvaBaseFonte, "fipe");
  assertEquals(r.ipvaViradaValor, 4_000);
});

Deno.test("G90-1 — dados faltantes bloqueiam recomendação financeira", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: null,
    createdAt: "2026-08-01",
    valorCompra: null,
    despesas: [],
    precoAnunciado: 100_000,
    referencias: [],
    config: DEFAULT_ESTOQUE_GIRO_CONFIG,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assert(r.dadosIncompletos.includes("custo de compra"));
  assert(!r.dadosIncompletos.some((d) => d.includes("FIPE")));
  assertEquals(r.recomendacao, "Completar dados antes de decidir");
});

Deno.test("CONSIG-1 — consignado não imobiliza valor, não tem IPVA nem desvalorização", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-08-24",
    createdAt: "2026-08-24",
    valorCompra: 105_000,
    despesas: [1_000],
    precoAnunciado: 120_000,
    referencias: [{ fonte: "fipe", valor: 110_000 }],
    config: {
      ...config,
      ipvaLojaPagaVirada: true,
      custoVagaDia: 30,
    },
    regraComissao: DEFAULT_COMISSAO_REGRA,
    consignacao: {
      dataInicio: "2026-08-24",
      prazoDias: 70,
      precoMinimoAutorizado: 115_000,
    },
  });
  assertEquals(r.consignado, true);
  assertEquals(r.custoAtual, 1_030); // despesa + juros só sobre a despesa por 60 dias
  assertEquals(r.ipvaViradaValor, null);
  assertEquals(r.ipvaProjetado, 0);
  assertEquals(r.custoDeEsperar30d, 915); // vaga 900 + juros da despesa 15
  assert(r.recomendacao.startsWith("Contrato vence em"));
});

Deno.test("CONSIG-1 — regressão: carro próprio mantém cálculo exato", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-08-24",
    createdAt: "2026-08-24",
    valorCompra: 80_000,
    despesas: [1_000, 500],
    precoAnunciado: 100_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config,
    regraComissao: DEFAULT_COMISSAO_REGRA,
  });
  assertEquals(r.consignado, false);
  assertEquals(r.custoAtual, 83_900);
  assertEquals(r.ipvaAliquotaEfetivaPct, 4);
});
