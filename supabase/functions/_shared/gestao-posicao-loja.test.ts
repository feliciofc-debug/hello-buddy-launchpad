import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatPosicaoLojaWhatsApp,
  formatPosicaoMoney,
  formatRelatorioVendedoresWhatsApp,
  loadPosicaoLojaFacts,
  type PosicaoLojaFacts,
  type RelatorioVendedoresFacts,
} from "./gestao-posicao-loja.ts";

function emptyQueryChain(
  result: { data?: unknown[] | null; count?: number | null } = { data: [], count: 0 },
): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    limit: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

function baseFacts(over: Partial<PosicaoLojaFacts> = {}): PosicaoLojaFacts {
  return {
    geradoEm: "18/10, 14:28",
    competencia: "2026-10",
    mesLabel: "outubro",
    storeUserId: "u1",
    lojaNomeCitada: null,
    mes: {
      qtdVendas: 4,
      faturamento: 3_050_000,
      lucroCarros: 454_000,
      margemCarrosPct: 14.9,
      lucroLiquido: 359_000,
      metaSalva: true,
      metaRealizado: 4,
      metaValor: 8,
      metaPct: 50,
      metaProjecaoPct: 86,
    },
    vendedoresTop: [
      {
        vendedor_id: "v1",
        nome: "Ana Souza",
        qtd: 2,
        faturamento: 1_140_000,
        lucroGerado: 145_000,
        comissao: 11_448,
      },
    ],
    estoque: {
      qtd: 6,
      valorAnunciado: 1_490_000,
      lucroProjetado: 243_000,
      parados90Qtd: 0,
      parados90ValorAnunciado: 0,
    },
    hoje: {
      despesasQtd: 2,
      despesasValor: 1500,
      vendasQtd: 0,
      leadsNovos: 3,
      conversasAtendidas: 8,
    },
    atencao: {
      contasVencidasQtd: 0,
      contasVencidasValor: 0,
      contas7DiasQtd: 2,
      contas7DiasValor: 12_600,
      custoCompraPendenteQtd: 0,
      vendaRegistradaSemVendidoQtd: 0,
      conciliacaoPendenteQtd: 0,
    },
    ...over,
  };
}

Deno.test("formatPosicaoMoney abrevia mi e mil", () => {
  assertEquals(formatPosicaoMoney(3_050_000), "R$ 3,05 mi");
  assertEquals(formatPosicaoMoney(454_000), "R$ 454 mil");
});

Deno.test("formatPosicaoLojaWhatsApp fixture completo", () => {
  const text = formatPosicaoLojaWhatsApp(baseFacts());
  assert(text.includes("Posição da loja"));
  assert(text.includes("Vendidos: 4 carros"));
  assert(text.includes("Nada pendente") || text.includes("vencem em 7 dias"));
  assert(text.includes("Leads novos: 3"));
  assert(text.length <= 1500);
});

Deno.test("formatPosicaoLojaWhatsApp sem vendas e nada pendente", () => {
  const text = formatPosicaoLojaWhatsApp(baseFacts({
    mes: {
      qtdVendas: 0,
      faturamento: 0,
      lucroCarros: 0,
      margemCarrosPct: null,
      lucroLiquido: -5000,
      metaSalva: false,
      metaRealizado: null,
      metaValor: null,
      metaPct: null,
      metaProjecaoPct: null,
    },
    vendedoresTop: [],
    atencao: {
      contasVencidasQtd: 0,
      contasVencidasValor: 0,
      contas7DiasQtd: 0,
      contas7DiasValor: 0,
      custoCompraPendenteQtd: 0,
      vendaRegistradaSemVendidoQtd: 0,
      conciliacaoPendenteQtd: 0,
    },
    hoje: {
      despesasQtd: 0,
      despesasValor: 0,
      vendasQtd: 0,
      leadsNovos: null,
      conversasAtendidas: null,
    },
  }));
  assert(text.includes("Vendidos: 0 carros"));
  assert(text.includes("Nada pendente ✅"));
  assert(!text.includes("Leads novos"));
  assert(text.length <= 1500);
});

Deno.test("loadPosicaoLojaFacts vendas hoje usa count em veiculo_id", async () => {
  let vendasHojeSelectCol = "";
  const sb = {
    from(table: string) {
      if (table === "veiculo_venda") {
        return {
          select(cols: string, opts?: { count?: string; head?: boolean }) {
            if (opts?.count === "exact" && opts?.head) {
              vendasHojeSelectCol = cols;
              return {
                eq: () => ({
                  eq: () => Promise.resolve({ count: 3, data: null, error: null }),
                }),
              };
            }
            return emptyQueryChain({ data: [] });
          },
        };
      }
      return emptyQueryChain();
    },
  };
  const facts = await loadPosicaoLojaFacts(
    sb as never,
    "u1",
    new Date("2026-10-18T17:28:00-03:00"),
  );
  assertEquals(vendasHojeSelectCol, "veiculo_id");
  assertEquals(facts.hoje.vendasQtd, 3);
  const text = formatPosicaoLojaWhatsApp({ ...facts, vendedoresTop: [], atencao: {
    ...facts.atencao,
    contas7DiasQtd: 0,
    contas7DiasValor: 0,
  } });
  assert(text.includes("Vendas registradas hoje: 3"));
});

Deno.test("formatRelatorioVendedores 0 e 3 vendedores", () => {
  const empty: RelatorioVendedoresFacts = {
    competencia: "2026-10",
    mesLabel: "outubro",
    diaRef: "18/10",
    ranking: [],
    metaByVendedorId: new Map(),
    lojaNomeCitada: null,
  };
  assertEquals(formatRelatorioVendedoresWhatsApp(empty), "👥 Vendedores — outubro (até 18/10)\n\nNenhuma venda registrada no mês.");

  const three: RelatorioVendedoresFacts = {
    ...empty,
    ranking: [
      { vendedor_id: "a", nome: "Ana", qtd: 2, faturamento: 1_000_000, lucroGerado: 100_000, comissao: 10_000 },
      { vendedor_id: "b", nome: "João", qtd: 1, faturamento: 800_000, lucroGerado: 200_000, comissao: 8_000 },
      { vendedor_id: "c", nome: "Carlos", qtd: 1, faturamento: 500_000, lucroGerado: 50_000, comissao: 5_000 },
    ],
    metaByVendedorId: new Map([["a", { pct: 67, realizado: 2, meta: 3 }]]),
  };
  const text = formatRelatorioVendedoresWhatsApp(three);
  assert(text.includes("Destaque:"));
  assert(text.includes("Total: 4 carros"));
  assert(text.length <= 1500);
});
