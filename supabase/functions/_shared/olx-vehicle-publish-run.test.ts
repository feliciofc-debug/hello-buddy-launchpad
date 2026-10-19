import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runOlxVehiclePublish } from "./olx-vehicle-publish-run.ts";

Deno.test("publicar veículo de outro user retorna 403 semantics", async () => {
  const sb = {
    from(table: string) {
      if (table === "veiculos_estoque") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { user_id: "outro", status: "disponivel", id: "v1" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null }) }),
          }),
        }),
      };
    },
  };
  const result = await runOlxVehiclePublish(sb, {
    userId: "meu",
    veiculoId: "v1",
    acao: "publicar",
  });
  assertEquals(result.ok, false);
  assertEquals(result.error, "Sem permissão para este veículo");
});
