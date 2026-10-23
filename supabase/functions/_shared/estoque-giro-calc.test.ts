import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";
import {
  calcularEstoqueGiro,
  DEFAULT_ESTOQUE_GIRO_CONFIG,
  diasEmEstoque,
  escolherReferenciaRepasse,
  faixaEstoqueGiro,
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
  assert(r.dadosIncompletos.includes("FIPE/Molicar B2B"));
  assertEquals(r.recomendacao, "Completar dados antes de decidir");
});
