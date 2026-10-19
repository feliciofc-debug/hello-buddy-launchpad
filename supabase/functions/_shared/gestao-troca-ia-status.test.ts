import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { statusAnaliseGestaoTroca } from "./gestao-troca-ia-ops.ts";

function mockSb(input: {
  analiseById?: Record<string, unknown> | null;
  itens?: Record<string, unknown>[];
  latest?: Record<string, unknown> | null;
  latestItens?: Record<string, unknown>[];
}) {
  return {
    from(table: string) {
      if (table === "gestao_troca_analise_ia") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === "id") {
                return {
                  maybeSingle: async () => ({ data: input.analiseById ?? null }),
                };
              }
              return {
                eq: (_col2: string, _val2: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: input.latest ?? null }),
                    }),
                  }),
                }),
              };
            },
          }),
        };
      }
      if (table === "gestao_troca_ia_item") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: input.itens ?? input.latestItens ?? [] }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

Deno.test("status_analise — exige analise_id ou troca_id", async () => {
  const r = await statusAnaliseGestaoTroca(mockSb({}) as never, "u1", {});
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 422);
});

Deno.test("status_analise — por analise_id do dono", async () => {
  const r = await statusAnaliseGestaoTroca(mockSb({
    analiseById: { id: "a1", user_id: "u1", status: "concluida" },
    itens: [{ id: "i1" }],
  }) as never, "u1", { analise_id: "a1" });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.analise?.id, "a1");
    assertEquals(r.itens.length, 1);
  }
});

Deno.test("status_analise — analise_id de outro user → 404", async () => {
  const r = await statusAnaliseGestaoTroca(mockSb({
    analiseById: { id: "a1", user_id: "outro", status: "concluida" },
  }) as never, "u1", { analise_id: "a1" });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 404);
});

Deno.test("status_analise — concluida retorna itens para polling", async () => {
  const r = await statusAnaliseGestaoTroca(mockSb({
    analiseById: { id: "a1", user_id: "u1", status: "concluida", km_painel_lido: 44714 },
    itens: [{ id: "i1", descricao: "Risco" }],
  }) as never, "u1", { analise_id: "a1" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.analise?.status, "concluida");
});

Deno.test("status_analise — por troca_id (última)", async () => {
  const r = await statusAnaliseGestaoTroca(mockSb({
    latest: { id: "a2", user_id: "u1", status: "concluida", troca_id: "t1" },
    latestItens: [],
  }) as never, "u1", { troca_id: "t1" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.analise?.id, "a2");
});
