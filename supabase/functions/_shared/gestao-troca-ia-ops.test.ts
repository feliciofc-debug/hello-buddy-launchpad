import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertNoGestaoTrocaAnaliseProcessando,
  assertPodeSolicitarAprovacaoTroca,
  GESTAO_TROCA_IA_LIMITE_DIARIO,
} from "./gestao-troca-ia-ops.ts";

Deno.test("limite diário constante 5", () => {
  assertEquals(GESTAO_TROCA_IA_LIMITE_DIARIO, 5);
});

Deno.test("bloqueia segunda analise processando", async () => {
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
    "processamento",
  );
});

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
