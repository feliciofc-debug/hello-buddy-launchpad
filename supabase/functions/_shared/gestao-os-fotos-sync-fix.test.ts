import {
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const FIX_MIGRATION = new URL(
  "../../migrations/20261032267000_gestao_os_fotos_sync_fix.sql",
  import.meta.url,
);

Deno.test("OS-1.7 — migration não usa variável homônima ordem (gestao_os row)", async () => {
  const sql = await Deno.readTextFile(FIX_MIGRATION);
  assertEquals(sql.includes("ordem public.gestao_os%ROWTYPE"), false);
  assertStringIncludes(sql, "v_os public.gestao_os%ROWTYPE");
  assertStringIncludes(sql, "v_had_foto_refs");
  assertMatch(sql, /ORDER BY fr2\.ordem ASC/);
  assertEquals(sql.includes("ORDER BY ordem ASC"), false);
});

Deno.test("OS-1.7 — auto-seleção anúncio só na primeira sincronização", async () => {
  const sql = await Deno.readTextFile(FIX_MIGRATION);
  assertStringIncludes(sql, "IF NOT v_had_foto_refs");
  assertStringIncludes(sql, "fr.origem = 'troca'");
  assertStringIncludes(sql, "fr2.origem = 'anuncio'");
  assertStringIncludes(sql, "LIMIT 4");
});

Deno.test("OS-1.7 — funções reescritas mantêm grants", async () => {
  const sql = await Deno.readTextFile(FIX_MIGRATION);
  assertStringIncludes(sql, "GRANT EXECUTE ON FUNCTION public.gestao_os_fotos_sincronizar");
  assertStringIncludes(sql, "GRANT EXECUTE ON FUNCTION public.gestao_os_excluir");
  assertStringIncludes(sql, "GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro");
});
