import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertMlItemOwnedByAmz } from "./ml-portal-ownership.ts";

Deno.test("assertMlItemOwnedByAmz — só true se external_id vinculado", async () => {
  const sb = {
    from(table: string) {
      if (table !== "veiculos_portais") throw new Error("unexpected");
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: (_a: string, externalId: string) => ({
                maybeSingle: async () => ({
                  data: externalId === "MLB123" ? { veiculo_id: "v1", external_id: "MLB123" } : null,
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
  assertEquals(await assertMlItemOwnedByAmz(sb, "u1", "MLB123"), true);
  assertEquals(await assertMlItemOwnedByAmz(sb, "u1", "MLB999"), false);
});
