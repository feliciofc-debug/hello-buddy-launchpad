import { assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertNoGestaoTrocaAnaliseProcessando,
  assertPodeSolicitarAprovacaoTroca,
} from "./gestao-troca-ia-ops.ts";

function mockSbComAnalise() {
  return {
    from: (table: string) => {
      if (table === "gestao_troca_analise_ia") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { id: "an1", alerta_km: true },
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [] }),
          }),
        }),
      };
    },
  };
}

Deno.test("solicitar aprovação bloqueada com alerta_km sem conferir", async () => {
  await assertRejects(
    () => assertPodeSolicitarAprovacaoTroca(mockSbComAnalise() as never, "u1", "t1", false),
    Error,
    "KM do painel",
  );
});

Deno.test("solicitar aprovação ok quando km conferido", async () => {
  await assertPodeSolicitarAprovacaoTroca(mockSbComAnalise() as never, "u1", "t1", true);
});
