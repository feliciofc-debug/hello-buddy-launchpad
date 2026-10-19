import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { claimGestaoTrocaDestino } from "./gestao-troca-ops.ts";

Deno.test("claim destino — segunda chamada retorna false", async () => {
  let destino: string | null = null;
  const sb = {
    from: (_table: string) => ({
      update: (patch: { destino?: string }) => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (destino === null && patch.destino) {
                      destino = patch.destino;
                      return { data: { id: "t1" }, error: null };
                    }
                    return { data: null, error: null };
                  },
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  const first = await claimGestaoTrocaDestino(sb as never, "u1", "t1", "estoque");
  const second = await claimGestaoTrocaDestino(sb as never, "u1", "t1", "estoque");
  assertEquals(first, true);
  assertEquals(second, false);
});
