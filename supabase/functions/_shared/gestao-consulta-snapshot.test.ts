import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSnapshotSemPii,
  loadGestaoConsultaSnapshot,
  resolveGestaoConsultaPeriodo,
} from "./gestao-consulta-snapshot.ts";
import { carrosLabel, mesNomePt } from "./gestao-posicao-loja.ts";
import { filterGestaoConsultaTools, CONSULTAR_DADOS_LOJA_TOOL } from "./gestao-consulta-tool.ts";
import { isGestaoLojaDataQuestion } from "./jarvis-gestao-data-intent.ts";
import { detectWebSearchIntent } from "./jarvis-web-search-intent.ts";

Deno.test("mesNomePt competencia UTC", () => {
  assertEquals(mesNomePt("2026-10"), "outubro");
  assertEquals(mesNomePt("2026-01"), "janeiro");
  assertEquals(mesNomePt("2026-12"), "dezembro");
});

Deno.test("carrosLabel plural", () => {
  assertEquals(carrosLabel(1), "1 carro");
  assertEquals(carrosLabel(3), "3 carros");
  assertEquals(carrosLabel(0), "0 carros");
});

Deno.test("resolveGestaoConsultaPeriodo hoje e semana SP", () => {
  const hoje = resolveGestaoConsultaPeriodo("hoje", new Date("2026-10-18T15:00:00-03:00"));
  assertEquals(hoje.inicio, hoje.fim);
  assertEquals(hoje.label, "hoje");
  const sem = resolveGestaoConsultaPeriodo("semana", new Date("2026-10-18T15:00:00-03:00"));
  assertEquals(sem.inicio, "2026-10-12");
  assertEquals(sem.fim, "2026-10-18");
});

function emptySbChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: null }),
    then(onF: (v: unknown) => unknown) {
      return Promise.resolve({ data: [], count: 0 }).then(onF);
    },
  };
  return chain;
}

Deno.test("snapshot mock vendas e sem PII", async () => {
  const vendaRow = {
    veiculo_id: "v1",
    valor_venda: 100000,
    data_venda: "2026-10-18",
    vendedor_id: null,
  };
  const sb = {
    from(table: string) {
      if (table === "gestao_conta_recorrencia_serie") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      if (table === "veiculo_venda") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [vendaRow] }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "veiculos_estoque") {
        return {
          select: () => ({
            eq: (_c: string, _v: string) => ({
              maybeSingle: () => Promise.resolve({
                data: { marca: "BMW", modelo: "X1", versao: null, status: "vendido", preco: 100000 },
              }),
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: { marca: "BMW", modelo: "X1", versao: null },
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => emptySbChain() };
    },
  };
  const snap = await loadGestaoConsultaSnapshot(
    sb as never,
    "u1",
    "hoje",
    new Date("2026-10-18T12:00:00-03:00"),
  );
  const vendas = snap.vendas as { lista: unknown[]; totais: { qtd: number } };
  assertEquals(vendas.totais.qtd, 1);
  const json = JSON.stringify(snap);
  assert(assertSnapshotSemPii(json));
  assert(!json.includes("telefone"));
});

Deno.test("consulta tool só quando autorizado", () => {
  const tools = [{ ...CONSULTAR_DADOS_LOJA_TOOL }, { type: "function", function: { name: "x" } }];
  assertEquals(filterGestaoConsultaTools(tools, false).length, 1);
  assertEquals(filterGestaoConsultaTools(tools, true).length, 2);
});

Deno.test("quais veiculos vendidos nao e web search", () => {
  assert(isGestaoLojaDataQuestion("Quais veículos foram vendidos ?"));
  assertEquals(detectWebSearchIntent("Quais veículos foram vendidos ?"), null);
});
