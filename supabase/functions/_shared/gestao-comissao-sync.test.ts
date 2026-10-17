import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyGestaoComissaoSync, planGestaoComissaoSync } from "./gestao-comissao-sync.ts";
import { DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";

Deno.test("plano de comissão gera lançamento vendedor", () => {
  const plan = planGestaoComissaoSync({
    userId: "u",
    veiculoId: "v",
    vendedorId: "s1",
    vendedorNome: "João",
    gerenteId: null,
    valorVenda: 100_000,
    lucroLiquido: 10_000,
    margemPct: 10,
    regraVendedor: DEFAULT_COMISSAO_REGRA,
    regraGerente: null,
    valorComissaoOverride: null,
    dataDespesa: "2026-02-01",
  });
  assertEquals(plan.lancamentos.length, 1);
  assertEquals(plan.lancamentos[0].valor, 150);
});

Deno.test("applyGestaoComissaoSync 3x mantém mesmo valor e uma despesa ativa", async () => {
  const despesas: Array<{ id: string; deleted_at: string | null }> = [];
  const autos: Array<{ despesa_id: string }> = [];
  let seq = 0;

  const client = {
    from(table: string) {
      const api = {
        select: () => api,
        eq: () => api,
        in: () => api,
        maybeSingle: async () => ({ data: null }),
        single: async () => ({ data: { id: `d-${++seq}` }, error: null }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const id = `d-${++seq}`;
              if (table === "veiculo_despesas") despesas.push({ id, deleted_at: null });
              return { data: { id }, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            in: (_c: string, ids: string[]) => {
              for (const d of despesas) {
                if (ids.includes(d.id)) d.deleted_at = String(patch.deleted_at);
              }
              return Promise.resolve({ error: null });
            },
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => {
              autos.length = 0;
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
      if (table === "gestao_comissao_auto") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: autos.map((a) => ({ despesa_id: a.despesa_id })) }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            autos.push({ despesa_id: String(row.despesa_id) });
            return Promise.resolve({ error: null });
          },
          delete: () => ({
            eq: () => ({
              eq: async () => {
                autos.length = 0;
                return { error: null };
              },
            }),
          }),
        };
      }
      return api;
    },
  };

  const input = {
    userId: "u",
    veiculoId: "v",
    vendedorId: "s1",
    vendedorNome: "João",
    gerenteId: null,
    valorVenda: 300_000,
    lucroLiquido: 45_000,
    margemPct: 15,
    regraVendedor: DEFAULT_COMISSAO_REGRA,
    regraGerente: null,
    valorComissaoOverride: null,
    dataDespesa: "2026-04-01",
  };

  const r1 = await applyGestaoComissaoSync(client, input);
  const r2 = await applyGestaoComissaoSync(client, input);
  const r3 = await applyGestaoComissaoSync(client, input);
  assertEquals(r1.comissaoTotal, r2.comissaoTotal);
  assertEquals(r2.comissaoTotal, r3.comissaoTotal);
  assertEquals(autos.length, 1);
});
