import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION_PATH =
  "supabase/migrations/20261013222000_fix_admin_criar_cliente_auth_schema.sql";

Deno.test("migration de criação de cliente usa o token do schema antigo", async () => {
  const migration = await Deno.readTextFile(MIGRATION_PATH);
  assertEquals(migration.includes("email_change_token_new"), false);
  assertEquals(migration.includes("email_change_token"), true);
});
