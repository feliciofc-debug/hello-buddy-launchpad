import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertGestaoTrocaLaudoNaoFinalizado } from "./gestao-troca-laudo-guard.ts";
import {
  allocGestaoTrocaLaudoNumero,
  reabrirLaudoGestaoTroca,
} from "./gestao-troca-laudo-ops.ts";

Deno.test("assert laudo finalizado bloqueia edição", () => {
  let threw = false;
  try {
    assertGestaoTrocaLaudoNaoFinalizado({ laudo_status: "finalizado" });
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes("finalizado"), true);
  }
  assertEquals(threw, true);
});

Deno.test("número sequencial por loja e ano", async () => {
  let ultimo = 0;
  const sb = {
    from: (table: string) => {
      if (table === "gestao_troca_laudo_numero") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: ultimo ? { ultimo } : null }),
              }),
            }),
          }),
          upsert: async (row: { ultimo: number }) => {
            ultimo = row.ultimo;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected ${table}`);
    },
  };
  const n1 = await allocGestaoTrocaLaudoNumero(sb as never, "user-1");
  const n2 = await allocGestaoTrocaLaudoNumero(sb as never, "user-1");
  assertEquals(n1.endsWith("-000001"), true);
  assertEquals(n2.endsWith("-000002"), true);
});

Deno.test("reabrir exige motivo mínimo", async () => {
  const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
  await assertRejects(
    () => reabrirLaudoGestaoTroca(sb as never, "u1", "u1@test", "t1", "curto"),
    Error,
    "10 caracteres",
  );
});
