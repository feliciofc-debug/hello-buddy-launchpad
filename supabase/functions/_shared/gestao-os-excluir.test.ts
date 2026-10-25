import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { podeExcluirOs } from "./gestao-os-domain.ts";

Deno.test("OS-1.6 — migration gestao_os_excluir", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032266000_gestao_os_excluir.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "gestao_os_excluir");
  assertStringIncludes(sql, "'rascunho', 'orcamento'");
  assertStringIncludes(sql, "despesa_id IS NOT NULL");
  assertStringIncludes(sql, "status = 'escolhida'");
  assertStringIncludes(sql, "gestao_os_cotacao_wa_sessao");
  assertStringIncludes(sql, "gestao-os-documentos");
  assertStringIncludes(sql, "auth.uid()");
});

Deno.test("OS-1.7 — gestao_os_excluir corrigido na migration de sync", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032267000_gestao_os_fotos_sync_fix.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "v_os public.gestao_os%ROWTYPE");
  assertEquals(sql.includes("ordem public.gestao_os%ROWTYPE"), false);
});

Deno.test("OS-1.6 — UI gate: exclui em rascunho e cotação", () => {
  assertEquals(podeExcluirOs({ status: "rascunho" }), true);
  assertEquals(podeExcluirOs({ status: "orcamento" }), true);
});

Deno.test("OS-1.6 — bloqueia aprovada, concluída, cancelada e com financeiro", () => {
  assertEquals(podeExcluirOs({ status: "aprovada" }), false);
  assertEquals(podeExcluirOs({ status: "concluida" }), false);
  assertEquals(podeExcluirOs({ status: "cancelada" }), false);
  assertEquals(podeExcluirOs({ status: "aguardando_aprovacao" }), false);
  assertEquals(podeExcluirOs({
    status: "rascunho",
    despesa_id: "00000000-0000-4000-8000-000000000001",
  }), false);
  assertEquals(podeExcluirOs({
    status: "orcamento",
    conta_lancamento_id: "00000000-0000-4000-8000-000000000002",
  }), false);
});
