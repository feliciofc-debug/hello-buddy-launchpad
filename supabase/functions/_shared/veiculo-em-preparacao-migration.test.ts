import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migrationUrl = new URL(
  "../../migrations/20261032250000_veiculo_em_preparacao.sql",
  import.meta.url,
);
const sql = await Deno.readTextFile(migrationUrl);

Deno.test("TROCA-VENDA-1.1 — migration inclui o novo status sem remover os atuais", () => {
  for (const status of ["disponivel", "reservado", "vendido", "em_preparacao"]) {
    assert(sql.includes(`'${status}'`), `status ausente: ${status}`);
  }
});

Deno.test("TROCA-VENDA-1.1 — carro recebido sempre termina em preparação", () => {
  assert(sql.includes("SET status = 'em_preparacao'"));
  assert(sql.includes("veiculo_entrada_id"));
});

Deno.test("TROCA-VENDA-1.1 — vendedor precisa pertencer ao tenant autenticado", () => {
  assert(sql.includes("FROM public.gestao_vendedores"));
  assert(sql.includes("AND user_id = uid"));
  assert(sql.includes("Vendedor não pertence a esta loja"));
  assertEquals(
    /p_vendedor_id IS NOT NULL AND NOT EXISTS/.test(sql),
    true,
  );
});
