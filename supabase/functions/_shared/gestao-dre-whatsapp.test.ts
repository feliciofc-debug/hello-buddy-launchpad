import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertGestaoDreWhatsappWaterfall,
  dreMargensPct,
  formatGestaoDreWhatsApp,
  parseGestaoCompetenciaFromText,
  type GestaoDreWhatsappFacts,
} from "./gestao-dre-whatsapp.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";
import { filterGestaoConsultaTools, CONSULTAR_DADOS_LOJA_TOOL } from "./gestao-consulta-tool.ts";

Deno.test("dreMargensPct treino bruta 14,9% e líquida 11,8%", () => {
  const dre = {
    competencia: "2026-10",
    faturamento: 3_052_800,
    custoCarros: 2_000_000,
    despesasCarros: 598_448,
    lucroCarros: 454_352,
    despesasOperacionais: 95_166.9,
    lucroLiquidoLoja: 359_185.1,
    margemLiquidaPct: 11.8,
    qtdVendas: 4,
  };
  const m = dreMargensPct(dre);
  assertEquals(m.margem_bruta_pct, 14.9);
  assertEquals(m.margem_liquida_pct, 11.8);
});

Deno.test("formatGestaoDreWhatsApp rotula margens bruta e líquida", () => {
  const facts: GestaoDreWhatsappFacts = {
    competencia: "2026-10",
    tituloMes: "Outubro/2026",
    ateDia: "18/10",
    dre: {
      competencia: "2026-10",
      faturamento: 3_052_800,
      custoCarros: 2_000_000,
      despesasCarros: 598_448,
      lucroCarros: 454_352,
      despesasOperacionais: 95_166.9,
      lucroLiquidoLoja: 359_185.1,
      margemLiquidaPct: 11.8,
      qtdVendas: 4,
    },
    comissaoTotal: 30_528,
    despesasCarrosSemComissao: 567_920,
    operacionaisPorCategoria: [{ label: "Aluguel", valor: 5000 }],
    metaRealizado: 4,
    metaAlvo: 8,
    metaTipo: "qtd",
    despesasEstoque: 12_000,
  };
  assertGestaoDreWhatsappWaterfall(facts);
  const text = formatGestaoDreWhatsApp(facts);
  assert(text.includes("margem bruta"));
  assert(text.includes("margem líquida"));
  assert(text.includes("Comissões"));
  assert(text.includes("3.052.800"));
  const idxCom = text.indexOf("Comissões");
  const idxBruto = text.indexOf("Lucro bruto");
  const idxOp = text.indexOf("Despesas operacionais");
  assert(idxCom > 0 && idxBruto > idxCom && idxOp > idxBruto);
  assert(text.includes("567.920") || text.includes("567.920,00"));
  assert(text.includes("4 de 8 carros"));
});

Deno.test("DRE waterfall fecha em centavos (treino)", () => {
  const facts: GestaoDreWhatsappFacts = {
    competencia: "2026-10",
    tituloMes: "Outubro/2026",
    ateDia: "18/10",
    dre: {
      competencia: "2026-10",
      faturamento: 3_052_800,
      custoCarros: 2_000_000,
      despesasCarros: 598_448,
      lucroCarros: 454_352,
      despesasOperacionais: 95_166.9,
      lucroLiquidoLoja: 359_185.1,
      margemLiquidaPct: 11.8,
      qtdVendas: 4,
    },
    comissaoTotal: 30_528,
    despesasCarrosSemComissao: 567_920,
    operacionaisPorCategoria: [],
    metaRealizado: null,
    metaAlvo: null,
    metaTipo: null,
    despesasEstoque: 0,
  };
  assertGestaoDreWhatsappWaterfall(facts);
});

Deno.test("dre de setembro → competência 2026-09", () => {
  const c = parseGestaoCompetenciaFromText(
    "dre de setembro",
    new Date("2026-10-18T12:00:00-03:00"),
  );
  assertEquals(c, "2026-09");
});

Deno.test("intent dre completo", () => {
  assertEquals(classifyGestaoIntent("dre completo").kind, "dre_whatsapp");
  assertEquals(classifyGestaoIntent("resultado do mês").kind, "dre_whatsapp");
});

Deno.test("consulta tool oculta para não autorizado", () => {
  const tools = [CONSULTAR_DADOS_LOJA_TOOL, { type: "function", function: { name: "x" } }];
  assertEquals(filterGestaoConsultaTools(tools, false).some((t) =>
    t.function.name === "consultar_dados_loja"
  ), false);
});
