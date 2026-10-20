import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertNoGestaoTrocaAnaliseProcessando,
  iniciarGestaoTrocaIaAnalise,
  loadGestaoTrocaIaUsoDiario,
} from "./gestao-troca-ia-ops.ts";

Deno.test("bloqueia segunda analise processando na mesma troca", async () => {
  const sb = {
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({ data: [{ id: "a1" }] }),
            }),
          }),
        }),
      }),
    }),
  };
  await assertRejects(
    () => assertNoGestaoTrocaAnaliseProcessando(sb as never, "u1", "t1"),
    Error,
    "análise em andamento",
  );
});

Deno.test("uso diário soma análises e fotos (informativo)", async () => {
  const sb = {
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lt: () => ({
              neq: async () => ({
                data: [
                  { status: "concluida", progresso_total: 3, qualidade_json: [] },
                  { status: "concluida", progresso_total: 0, qualidade_json: [{ usada: true }, { usada: false }] },
                ],
              }),
            }),
          }),
        }),
      }),
    }),
  };
  const uso = await loadGestaoTrocaIaUsoDiario(sb as never, "u1");
  assertEquals(uso.analises, 2);
  assertEquals(uso.fotos, 4);
});

function mockSbIniciarAnalise(trocaId: string) {
  let seq = 0;
  return {
    from: (table: string) => {
      if (table === "gestao_troca") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: trocaId, laudo_status: "rascunho" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "gestao_troca_analise_ia") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({ data: [] as { id: string }[] }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => {
                seq += 1;
                return { data: { id: `analise-${seq}` }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

Deno.test("10 análises seguidas na mesma troca — todas aceitas (sem limite diário)", async () => {
  const sb = mockSbIniciarAnalise("t1");
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = await iniciarGestaoTrocaIaAnalise(sb as never, "u1", "t1", {
      scheduleBackground: false,
    });
    ids.push(r.analise_id);
  }
  assertEquals(ids.length, 10);
  assertEquals(new Set(ids).size, 10);
});
