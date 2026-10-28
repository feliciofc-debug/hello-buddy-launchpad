import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const legacyName = "silvester";
const migrationName = "20261032300000_remove_silvester.sql";

Deno.test("SILV-0 — runtime e frontend não dependem do agente legado", async () => {
  const processor = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const app = await Deno.readTextFile(
    new URL("../../../src/App.tsx", import.meta.url),
  );
  const types = await Deno.readTextFile(
    new URL("../../../src/integrations/supabase/types.ts", import.meta.url),
  );
  const config = await Deno.readTextFile(
    new URL("../../config.toml", import.meta.url),
  );

  for (const source of [processor, app, types, config]) {
    assertEquals(source.toLowerCase().includes(legacyName), false);
  }
  assertEquals(app.includes("/dossies"), false);
  assertEquals(processor.includes("PRÉ-ATENDIMENTO DE CONSÓRCIO"), false);
});

Deno.test("SILV-0 — migração remove dependências, tabelas, flag e bucket", async () => {
  const migration = await Deno.readTextFile(
    new URL(`../../migrations/${migrationName}`, import.meta.url),
  );

  assertStringIncludes(
    migration,
    "DROP TABLE IF EXISTS public.silvester_documentos CASCADE",
  );
  assertStringIncludes(
    migration,
    "DROP TABLE IF EXISTS public.silvester_dossies CASCADE",
  );
  assert(
    migration.indexOf("DROP TABLE IF EXISTS public.silvester_documentos") <
      migration.indexOf("DROP TABLE IF EXISTS public.silvester_dossies"),
  );
  assertStringIncludes(
    migration,
    "DROP FUNCTION IF EXISTS public.silvester_calcular_score() CASCADE",
  );
  assertStringIncludes(
    migration,
    "DROP COLUMN IF EXISTS silvester_dossie_ativo",
  );
  assertStringIncludes(migration, "silvester-docs");
  assertStringIncludes(migration, "DROP POLICY IF EXISTS");
  assertStringIncludes(migration, "DROP TRIGGER IF EXISTS");
  assertStringIncludes(migration, "DROP VIEW IF EXISTS");
});
