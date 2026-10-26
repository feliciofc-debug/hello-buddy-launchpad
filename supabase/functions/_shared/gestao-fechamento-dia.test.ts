import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatarGestaoFechamentoDia,
  type GestaoFechamentoDia,
} from "./gestao-fechamento-dia.ts";

function fixture(): GestaoFechamentoDia {
  return {
    dia: "2026-10-26",
    vendasHoje: {
      qtd: 2,
      faturamento: 145000,
      lucro: 18500,
      margemPct: 12.76,
      ticketMedio: 72500,
    },
    vendasMes: {
      qtd: 11,
      faturamento: 825000,
      lucro: 104000,
      margemPct: 12.61,
      ticketMedio: 75000,
    },
    comparacaoMesAnteriorPct: 8.4,
    estoque: {
      total: 27,
      valorImobilizado: 1680000,
      entradasHoje: 1,
      saidasHoje: 2,
      emPreparacao: 4,
      consignados: 3,
    },
    custoEstoque: {
      hoje: 1240.5,
      mes: 23890.1,
      dias30: 5,
      dias60: 3,
      dias90Mais: 1,
      top3: [{
        label: "Jeep Compass 2022",
        dias: 104,
        custoMes: 4210,
        margemConsumidaPct: 18.2,
      }],
    },
    operacao: {
      osAbertas: 8,
      osEmCotacao: 3,
      cotacoesRecebidasHoje: 1,
      osParadas: 2,
      preparacaoParada: 1,
      cotacaoOsNumero: 47,
    },
    financeiro: {
      pagar7Dias: 28400,
      receber7Dias: 61500,
      pagarVencido: 2200,
      receberVencido: 0,
      despesaOperacionalHoje: 1850,
      repasseHoje: 9000,
      trocoHoje: 3500,
      custoVeiculoHoje: 2700,
    },
    atendimento: {
      conversasHoje: 38,
      leadsNovos: 7,
      leadsQuentesSemRetorno24h: 2,
    },
    acoes: [
      "Avaliar preço ou repasse do Jeep Compass 2022 (104 dias)",
      "Escolher cotação da OS #47",
      "Retornar 2 leads quentes sem resposta",
    ],
  };
}

Deno.test("RESUMO-2 — builder omite totais inexistentes sem inventar", () => {
  const f = fixture();
  f.vendasHoje = {
    qtd: 0,
    faturamento: 0,
    lucro: 0,
    margemPct: null,
    ticketMedio: null,
  };
  f.operacao = {
    osAbertas: 0,
    osEmCotacao: 0,
    cotacoesRecebidasHoje: 0,
    osParadas: 0,
    preparacaoParada: 0,
  };
  const text = formatarGestaoFechamentoDia(f);
  assertStringIncludes(text, "Hoje: nenhuma venda");
  assertStringIncludes(text, "OS abertas: 0 · em cotação: 0");
  assertEquals(text.includes("Cotações recebidas hoje"), false);
});

Deno.test("RESUMO-2 — consignado e carro 90+ aparecem no fechamento", () => {
  const text = formatarGestaoFechamentoDia(fixture());
  assertStringIncludes(text, "Consignados: 3");
  assertStringIncludes(text, "90+ dias 1");
  assertStringIncludes(text, "Jeep Compass 2022 · 104 dias");
  assertStringIncludes(text, "margem consumida 18,2%");
});

Deno.test("RESUMO-2 — mensagem longa remove top 3 antes de truncar", () => {
  const f = fixture();
  f.custoEstoque.top3 = Array.from({ length: 3 }, (_, i) => ({
    label: `Veículo ${i + 1} ${"muito detalhado ".repeat(30)}`,
    dias: 100 + i,
    custoMes: 5000 + i,
    margemConsumidaPct: 20,
  }));
  const text = formatarGestaoFechamentoDia(f, 1200);
  assert(text.length <= 1200);
  assertEquals(text.includes("Veículo 1"), false);
  assertStringIncludes(text, "DECIDA HOJE");
});

Deno.test("RESUMO-2 — exemplo fictício completo", () => {
  const text = formatarGestaoFechamentoDia(fixture());
  console.log(`\nMENSAGEM_EXEMPLO_RESUMO_2\n${text}\n`);
  assert(text.length <= 3500);
  assertStringIncludes(text, "Despesa operacional hoje");
  assertStringIncludes(text, "À parte: repasse");
});
