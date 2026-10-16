import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION =
  "supabase/migrations/20261014220000_vitrine_veiculos_demo.sql";

Deno.test("migration demo vitrine é idempotente", async () => {
  const sql = await Deno.readTextFile(MIGRATION);
  assertStringIncludes(sql, "ADD COLUMN IF NOT EXISTS vitrine_veiculos_demo");
  assertStringIncludes(sql, "DEFAULT false");
});
