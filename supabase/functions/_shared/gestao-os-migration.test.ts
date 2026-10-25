import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const schema = await Deno.readTextFile(new URL(
  "../../migrations/20261032260000_gestao_os_schema.sql",
  import.meta.url,
));
const domain = await Deno.readTextFile(new URL(
  "../../migrations/20261032261000_gestao_os_domain.sql",
  import.meta.url,
));

Deno.test("OS-1 — migration cria entidades, RLS e bucket privado", () => {
  for (const table of [
    "gestao_parceiro",
    "gestao_parceiro_servico",
    "gestao_os",
    "gestao_os_item",
    "gestao_os_vistoria",
    "gestao_os_documento",
    "gestao_os_evento",
    "gestao_garantia",
    "gestao_garantia_ocorrencia",
  ]) {
    assertStringIncludes(schema, `public.${table}`);
    assertStringIncludes(schema, `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
  }
  assertStringIncludes(schema, "'gestao-os-documentos', false");
  assertStringIncludes(schema, "(user_id, veiculo_id)");
  assertStringIncludes(schema, "(user_id, parceiro_id)");
});

Deno.test("OS-1 — laudo é idempotente e conclusão gera uma despesa e uma conta", () => {
  assertStringIncludes(schema, "gestao_os_troca_preparacao_uidx");
  assertStringIncludes(domain, "ON CONFLICT DO NOTHING");
  assertStringIncludes(domain, "ordem.despesa_id IS NULL");
  assertStringIncludes(domain, "ordem.conta_lancamento_id IS NULL");
  assertEquals((domain.match(/INSERT INTO public\.veiculo_despesas/g) ?? []).length, 1);
  assertEquals((domain.match(/INSERT INTO public\.gestao_conta_lancamento/g) ?? []).length, 1);
});

Deno.test("OS-1 — garantia vira custo pós-venda sem reescrever venda", () => {
  assertStringIncludes(schema, "'os_garantia'");
  assertStringIncludes(domain, "origem_op := 'os_' || ordem.tipo");
  assertStringIncludes(domain, "FROM public.veiculo_venda");
  assertStringIncludes(domain, "AFTER INSERT ON public.veiculo_venda");
  assertEquals(domain.includes("UPDATE public.veiculo_venda"), false);
});

Deno.test("OS-1 — owner-only e eventos append-only", () => {
  assertStringIncludes(schema, "auth.uid() = user_id");
  assertStringIncludes(schema, "GRANT SELECT, INSERT ON public.gestao_os_evento TO authenticated");
  assertEquals(
    schema.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_os_evento TO authenticated"),
    false,
  );
  assertStringIncludes(domain, "Parceiro não pertence a esta loja");
  assertStringIncludes(domain, "Veículo não pertence a esta loja");
});

Deno.test("OS-1.1 — authenticated não atualiza campos protegidos da OS", () => {
  assertStringIncludes(schema, "GRANT SELECT ON public.gestao_os TO authenticated");
  assertStringIncludes(schema, "REVOKE INSERT, UPDATE, DELETE ON public.gestao_os FROM authenticated");
  assertStringIncludes(schema, "GRANT UPDATE (\n  parceiro_id, data_prevista, observacao, conta_vencimento, valor_estimado");
  assertEquals(
    schema.includes("public.gestao_parceiro_servico, public.gestao_os,"),
    false,
  );
  assertStringIncludes(domain, "'os_auto', 'custo_veiculo'");
});

Deno.test("OS-1.2 — bucket gestao-os-documentos adapta-se ao schema do storage", () => {
  assertStringIncludes(schema, "information_schema.columns");
  assertStringIncludes(schema, "AND column_name = 'public'");
  assertStringIncludes(schema, "file_size_limit, allowed_mime_types");
  assertStringIncludes(schema, "15728640");
  assertStringIncludes(schema, "ON CONFLICT (id) DO UPDATE SET public = false");
  assertStringIncludes(schema, "INSERT INTO storage.buckets (id, name)");
  assertStringIncludes(schema, "ON CONFLICT (id) DO NOTHING");
  assertStringIncludes(schema, "storage.foldername(name))[1]");
  assertEquals(schema.includes("INSERT INTO storage.buckets (id, name, public"), true);
});

Deno.test("OS-1 — liberação exige foto, preço e nenhuma OS aberta", () => {
  assertStringIncludes(domain, "array_length(NEW.fotos, 1)");
  assertStringIncludes(domain, "NEW.preco IS NULL OR NEW.preco <= 0");
  assertStringIncludes(domain, "status NOT IN ('concluida', 'cancelada')");
});
