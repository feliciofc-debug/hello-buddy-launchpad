import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION = "supabase/migrations/20261015160000_financiamento_fichas.sql";
const sql = await Deno.readTextFile(MIGRATION);

Deno.test("financiamento_fichas migration idempotente com RLS", () => {
  assertStringIncludes(sql, "BEGIN;");
  assertStringIncludes(sql, "COMMIT;");
  assertStringIncludes(sql, "CREATE TABLE IF NOT EXISTS public.financiamento_fichas");
  assertStringIncludes(sql, "campos_pendentes text[] NOT NULL DEFAULT '{}'");
  assertStringIncludes(sql, "tempo_residencia text");
  assertStringIncludes(sql, "referencia_nome text");
  assertStringIncludes(sql, "CREATE OR REPLACE FUNCTION public.update_updated_at_column");
  assertStringIncludes(sql, "ENABLE ROW LEVEL SECURITY");
  assertStringIncludes(sql, "USING (auth.uid() = user_id)");
  assertStringIncludes(sql, "DROP POLICY IF EXISTS");
  assertEquals(sql.includes("nome_completo text NOT NULL"), false);
  assertEquals(sql.includes("storage"), false);
});
