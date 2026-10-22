import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveMediaEditChainRoot } from "./media-edit-chain.ts";

Deno.test("resolveMediaEditChainRoot — sobe midia_pai_id até a raiz", async () => {
  const nodes: Record<string, { id: string; midia_pai_id?: string | null }> = {
    "edit-2": { id: "edit-2", midia_pai_id: "edit-1" },
    "edit-1": { id: "edit-1", midia_pai_id: "original" },
    original: { id: "original", midia_pai_id: null },
  };
  const root = await resolveMediaEditChainRoot(
    { id: "edit-2", midia_pai_id: "edit-1" },
    async (parentId) => nodes[parentId] ?? null,
  );
  assertEquals(root?.id, "original");
});
