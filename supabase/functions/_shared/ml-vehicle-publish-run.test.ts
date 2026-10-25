import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runMlVehiclePublish } from "./ml-vehicle-publish-run.ts";

Deno.test("TROCA-VENDA-1.1 — Mercado Livre bloqueia veículo em preparação", async () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () =>
      Promise.resolve({
        data: {
          id: "v1",
          user_id: "u1",
          status: "em_preparacao",
        },
        error: null,
      }),
  };
  const sb = {
    from: (table: string) => {
      if (table !== "veiculos_estoque") {
        throw new Error(`consulta inesperada: ${table}`);
      }
      return chain;
    },
  };

  const result = await runMlVehiclePublish(
    sb,
    { userId: "u1", veiculoId: "v1" },
  );
  assertEquals(result.ok, false);
  assertEquals(result.error?.includes("em preparação"), true);
});
