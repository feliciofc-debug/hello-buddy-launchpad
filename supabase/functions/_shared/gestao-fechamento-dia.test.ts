import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  contarConversasClientesNoDia,
  contatoInternoFechamento,
  estoqueValorCustoInvestidoFechamento,
  formatarCabecalhoFechamento,
  formatarGestaoFechamentoDia,
  isEventoNoDiaSp,
  montarFiltroContasFechamento,
  montarGestaoFechamentoAcoes,
  type GestaoFechamentoDia,
} from "./gestao-fechamento-dia.ts";
import type { GiroResumoVeiculoLinha } from "./giro-resumo-mensagem.ts";
import { VEICULO_STATUS_ATIVOS_INTERNOS } from "./veiculo-estoque-status.ts";

function fixture(): GestaoFechamentoDia {
  return {
    dia: "2026-10-26",
    lojaNome: "Auto Center SP",
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

Deno.test("RESUMO-2.1 — filtro contas e estoque ativo no builder", async () => {
  const source = await Deno.readTextFile(new URL(
    "./gestao-fechamento-dia.ts",
    import.meta.url,
  ));
  assertStringIncludes(source, '.in("status", statusAtivos)');
  assertStringIncludes(source, "VEICULO_STATUS_ATIVOS_INTERNOS");
  assertStringIncludes(source, "montarFiltroContasFechamento(dia)");
  assertStringIncludes(source, '.in("veiculo_id", ids)');
  assertEquals(
    montarFiltroContasFechamento("2026-10-26").includes("pago_em.eq.2026-10-26"),
    true,
  );
  assertEquals(statusAtivosIncludes(), true);
});

function statusAtivosIncludes(): boolean {
  return VEICULO_STATUS_ATIVOS_INTERNOS.includes("disponivel");
}

Deno.test("RESUMO-2.1 — fuso SP em timestamp (21h+ no mesmo dia civil)", () => {
  // 2026-10-27 00:30 UTC = 26/10 21:30 em São Paulo
  assertEquals(
    isEventoNoDiaSp("2026-10-27T00:30:00.000Z", "2026-10-26"),
    true,
  );
  assertEquals(
    isEventoNoDiaSp("2026-10-27T02:59:59.000Z", "2026-10-26"),
    true,
  );
  assertEquals(
    isEventoNoDiaSp("2026-10-27T03:00:00.000Z", "2026-10-26"),
    false,
  );
  assertEquals(isEventoNoDiaSp("2026-10-26", "2026-10-26"), true);
});

Deno.test("RESUMO-2.1 — atendimento exclui dono e parceiro", () => {
  const internos = new Set(["5521999990001", "5521888880002"]);
  assertEquals(contatoInternoFechamento("5521999990001", internos), true);
  assertEquals(contatoInternoFechamento("5521888880002", internos), true);
  assertEquals(contatoInternoFechamento("5511977773333", internos), false);
});

Deno.test("RESUMO-2.1 — textos cabeçalho e labels corrigidos", () => {
  const cab = formatarCabecalhoFechamento("Auto Center SP", "2026-10-26");
  assertStringIncludes(cab, "FECHAMENTO DO DIA — Auto Center SP · 26/10");
  const text = formatarGestaoFechamentoDia(fixture());
  assertStringIncludes(text, cab);
  assertStringIncludes(
    text,
    "Mês vs. mesmo período do mês anterior (faturamento): +8,4%",
  );
  assertStringIncludes(text, "Acumulado do mês (carros em estoque):");
  const semVenda = formatarGestaoFechamentoDia({
    ...fixture(),
    vendasHoje: {
      qtd: 0,
      faturamento: 0,
      lucro: 0,
      margemPct: null,
      ticketMedio: null,
    },
  });
  assertStringIncludes(semVenda, "🚗 *VENDAS*");
  assertStringIncludes(semVenda, "Hoje: nenhuma venda");
});

Deno.test("RESUMO-2.2 — conversas: mensagens do dia primeiro, sem listar todas", async () => {
  const internos = new Set(["5521999990001"]);
  const conversations = Array.from({ length: 1100 }, (_, i) => ({
    id: `conv-${i}`,
    contact_number: i === 0
      ? "5521999990001"
      : `5521${800000000 + i}`,
  }));
  const messages = Array.from({ length: 1200 }, (_, i) => ({
    conversation_id: `conv-${i % 1100}`,
    sender: "client",
    created_at: "2026-10-26T15:00:00-03:00",
  }));
  let maxInChunk = 0;
  let loadedAllConversations = false;

  const sb = {
    from(table: string) {
      if (table === "whatsapp_cloud_messages") {
        const state = { offset: 0 };
        const chain = {
          select: () => chain,
          eq: () => chain,
          gte: () => chain,
          lte: () => chain,
          neq: () => chain,
          range: (from: number, to: number) =>
            Promise.resolve({
              data: messages.slice(from, Math.min(to + 1, messages.length)),
            }),
        };
        return chain;
      }
      if (table === "whatsapp_cloud_conversations") {
        return {
          select: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) => {
                maxInChunk = Math.max(maxInChunk, ids.length);
                if (ids.length > 150) loadedAllConversations = true;
                return Promise.resolve({
                  data: conversations.filter((c) => ids.includes(c.id)),
                });
              },
            }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  } as unknown as SupabaseClient;

  const count = await contarConversasClientesNoDia(
    sb,
    "user-1",
    "2026-10-26",
    "2026-10-26T00:00:00-03:00",
    "2026-10-26T23:59:59-03:00",
    internos,
  );
  assertEquals(count, 1099);
  assertEquals(loadedAllConversations, false);
  assert(maxInChunk <= 150);
});

Deno.test("RESUMO-2.3 — custo investido = compra + despesas (snapshot), sem consignado", () => {
  const consignados = new Set(["c-consign"]);
  const total = estoqueValorCustoInvestidoFechamento(
    [
      { id: "a", marca: "BMW", status: "disponivel" },
      { id: "b", marca: "Audi", status: "reservado" },
      { id: "c-consign", marca: "Fiat", status: "disponivel" },
      { id: "pendente", marca: "VW", status: "disponivel" },
    ],
    [
      { veiculo_id: "a", valor_compra: 150_000 },
      { veiculo_id: "b", valor_compra: 80_000 },
      { veiculo_id: "c-consign", valor_compra: 999_999 },
      { veiculo_id: "pendente", valor_compra: null },
    ],
    [
      { veiculo_id: "a", valor: 5_000 },
      { veiculo_id: "a", valor: 1_200 },
      { veiculo_id: "b", valor: 2_000 },
      { veiculo_id: "c-consign", valor: 50_000 },
    ],
    consignados,
  );
  assertEquals(total, 150_000 + 6_200 + 80_000 + 2_000);
  const texto = formatarGestaoFechamentoDia({
    ...fixture(),
    estoque: { ...fixture().estoque, valorImobilizado: total },
  });
  assertStringIncludes(texto, "investido");
  assertEquals(texto.includes("imobilizado"), false);
});

Deno.test("RESUMO-2.3 — linha do mês em VENDAS usa lucro bruto", () => {
  const text = formatarGestaoFechamentoDia(fixture());
  assertStringIncludes(text, "Mês: 11 · R$");
  assertStringIncludes(text, "lucro bruto R$");
  assertStringIncludes(text, "104.000,00");
  assertEquals(text.match(/Mês:[^\n]* · lucro R\$/), null);
});

Deno.test("RESUMO-2.3 — DECIDA HOJE prioriza contas vencidas antes de cotação", () => {
  const giro: GiroResumoVeiculoLinha[] = [{
    label: "Jeep Compass 2022",
    dias: 95,
    resultado: { custoDeEsperar30d: 3000, margemVarejoHoje: 10000 },
  } as GiroResumoVeiculoLinha];
  const acoes = montarGestaoFechamentoAcoes({
    dia: "2026-10-26",
    giroItems: giro,
    recebidasHojeCount: 1,
    cotacaoOsNumero: 47,
    financeiro: {
      pagar7Dias: 0,
      receber7Dias: 0,
      pagarVencido: 12_600,
      receberVencido: 0,
      despesaOperacionalHoje: 0,
      repasseHoje: 0,
      trocoHoje: 0,
      custoVeiculoHoje: 0,
    },
    contas: [],
    leadsQuentes: 5,
  });
  assertEquals(acoes.length, 3);
  assertStringIncludes(acoes[0], "Jeep Compass");
  assertStringIncludes(acoes[1], "Pagar ou reagendar contas vencidas");
  assertStringIncludes(acoes[1], "12.600");
  assertStringIncludes(acoes[2], "OS #47");
});
