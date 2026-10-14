import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const MIGRATION_PATH =
  "supabase/migrations/20261014135000_vehicle_inventory_vertical.sql";

const migration = await Deno.readTextFile(MIGRATION_PATH);

Deno.test("estoque de veículos usa tabela própria e campos compatíveis", () => {
  assertStringIncludes(migration, "CREATE TABLE IF NOT EXISTS public.veiculos_estoque");
  assertStringIncludes(migration, "versao text");
  assertStringIncludes(migration, "km integer");
  assertStringIncludes(migration, "opcionais text[]");
  assertStringIncludes(migration, "caracteristicas text[]");
  assertStringIncludes(migration, "UNIQUE (user_id, codigo_origem)");
  assertEquals(migration.includes("public.produtos"), false);
});

Deno.test("RLS isola cada tenant pelo user_id", () => {
  assertStringIncludes(
    migration,
    "ALTER TABLE public.veiculos_estoque ENABLE ROW LEVEL SECURITY",
  );
  assertStringIncludes(migration, "USING (auth.uid() = user_id)");
  assertStringIncludes(migration, "WITH CHECK (auth.uid() = user_id)");
  assertStringIncludes(
    migration,
    "GRANT ALL ON public.veiculos_estoque TO service_role",
  );
});

Deno.test("tipo de revenda troca produtos por veículos no menu", () => {
  assertStringIncludes(migration, "'revenda_veiculos'");
  assertStringIncludes(
    migration,
    "array_replace(menus_permitidos, 'produtos', 'veiculos')",
  );
  assertStringIncludes(migration, "CHECK (\n    tipo IS NULL OR tipo IN (");
});

Deno.test("Royal passa para o tipo de revenda de veículos", () => {
  assertStringIncludes(migration, "SET tipo = 'revenda_veiculos'");
  assertStringIncludes(migration, "royal4x4@royal4x4.com.br");
});
