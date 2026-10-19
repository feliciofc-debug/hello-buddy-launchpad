import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleVeiculoProcedenciaAction } from "./veiculo-procedencia-handler.ts";

Deno.test("sem login → 401", async () => {
  const r = await handleVeiculoProcedenciaAction({ action: "status" }, null, {} as never);
  assertEquals(r.status, 401);
});

Deno.test("processar_job → 400", async () => {
  const r = await handleVeiculoProcedenciaAction(
    { action: "processar_job" },
    { id: "u1" },
    {} as never,
  );
  assertEquals(r.status, 400);
  assertEquals(r.body.error, "Ação inválida");
});

Deno.test("status_consulta de outro user → 404", async () => {
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    }),
  };
  const r = await handleVeiculoProcedenciaAction(
    { action: "status_consulta", consulta_id: "c1" },
    { id: "user-a" },
    admin as never,
  );
  assertEquals(r.status, 404);
});
