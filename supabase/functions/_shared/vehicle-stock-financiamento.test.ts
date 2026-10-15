import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  advanceFinanciamentoAfterText,
  applyFinanciamentoPerfil,
  beginFinanciamentoCorrecao,
  buildFinanciamentoFichaRow,
  buildFinanciamentoResumoText,
  mergePendingForFinanciamentoStart,
} from "./vehicle-stock-financiamento.ts";

const NOW = "2026-10-15T12:00:00.000Z";

function baseForm(step: string) {
  return {
    flow: "financiamento" as const,
    step,
    veiculo_id: "v1",
    lgpd_aceite_em: NOW,
    campos_pendentes: [] as string[],
    updated_at: NOW,
  };
}

Deno.test("pular e-mail permite salvar ficha só com LGPD", () => {
  let form = baseForm("email");
  const skipped = advanceFinanciamentoAfterText(form, "pular", NOW, { skipOptional: true });
  form = skipped.form;
  assert(form.campos_pendentes?.includes("email"));
  form = {
    ...form,
    prazo_meses: "36",
  };
  const row = buildFinanciamentoFichaRow({
    userId: "u1",
    form,
    fromNumber: "5521999999999",
  });
  assert(row);
  assertEquals(row!.email, null);
  assert(row!.campos_pendentes.includes("email"));
});

Deno.test("perfil assalariado encaminha para empresa", () => {
  const form = baseForm("perfil");
  const next = applyFinanciamentoPerfil(form, "assalariado", NOW);
  assertEquals(next.step, "empresa");
  assertEquals(next.perfil, "assalariado");
});

Deno.test("resumo → corrigir e-mail → resumo", () => {
  let form = {
    ...baseForm("resumo"),
    email: "velho@test.com",
    nome_completo: "Ana Silva",
  };
  form = beginFinanciamentoCorrecao(form, "email", NOW);
  assertEquals(form.step, "email");
  assertEquals(form.fin_corrigindo, true);
  const fixed = advanceFinanciamentoAfterText(
    form,
    "novo@test.com",
    NOW,
    { skipOptional: false },
  );
  assertEquals(fixed.form.step, "resumo");
  assertEquals(fixed.form.fin_corrigindo, false);
  assertEquals(fixed.form.email, "novo@test.com");
});

Deno.test("resumo mascara CPF e não mostra renda completa", () => {
  const text = buildFinanciamentoResumoText({
    ...baseForm("resumo"),
    cpf_cnpj: "52998224725",
    renda_mensal: "4500",
    nome_completo: "Teste",
  });
  assert(text.includes("52998224725") === false);
  assert(text.includes("***.***."));
  assert(text.includes("Informada") || text.includes("pendente"));
});

Deno.test("merge inicia no passo modo", () => {
  const pending = mergePendingForFinanciamentoStart(null, {
    id: "v1",
    marca: "VW",
    modelo: "Golf",
    versao: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 1,
    preco: 90000,
    cor: null,
    cambio: null,
    combustivel: null,
    portas: null,
    blindado: false,
    nivel_blindagem: null,
    opcionais: null,
    caracteristicas: null,
    descricao: null,
    fotos: null,
    status: "disponivel",
  }, NOW);
  assertEquals(pending.form?.step, "modo");
});
