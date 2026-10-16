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
  financiamentoStepSequenceAfterLgpd,
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

Deno.test("e-mail falado normaliza arroba e ponto", () => {
  const form = baseForm("email");
  const next = advanceFinanciamentoAfterText(
    form,
    "ana ponto silva arroba gmail ponto com",
    NOW,
    { skipOptional: false },
  );
  assertEquals(next.form.email, "ana.silva@gmail.com");
});

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

Deno.test("após e-mail o próximo passo é CEP (não tempo de residência)", () => {
  const form = baseForm("email");
  const next = advanceFinanciamentoAfterText(form, "ana@test.com", NOW, {});
  assertEquals(next.form.step, "cep");
});

Deno.test("complemento leva a tempo de residência antes do perfil", () => {
  const form = {
    ...baseForm("complemento"),
    cep: "01310100",
    logradouro: "Av Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    numero: "1000",
  };
  const next = advanceFinanciamentoAfterText(form, "apto 12", NOW, {});
  assertEquals(next.form.step, "tempo_residencia");
});

const PERFIS = ["assalariado", "autonomo", "empresario", "aposentado"] as const;

for (const perfil of PERFIS) {
  Deno.test(`sequência LGPD→resumo inclui CEP/endereço antes de tempo_residencia (${perfil})`, () => {
    const seq = financiamentoStepSequenceAfterLgpd(perfil);
    const iEmail = seq.indexOf("email");
    const iCep = seq.indexOf("cep");
    const iCompl = seq.indexOf("complemento");
    const iTempo = seq.indexOf("tempo_residencia");
    const iPerfil = seq.indexOf("perfil");
    const iResumo = seq.indexOf("resumo");
    assert(iEmail >= 0 && iCep > iEmail, "CEP após e-mail");
    assert(iCompl > iCep, "complemento após CEP");
    assert(iTempo > iCompl, "tempo residência após complemento");
    assert(iPerfil > iTempo, "perfil após tempo residência");
    assert(iResumo === seq.length - 1, "termina em resumo");
    if (perfil === "assalariado") {
      assert(seq.includes("empresa") && seq.includes("tempo_trabalho"));
    }
    if (perfil === "autonomo" || perfil === "empresario") {
      assert(seq.includes("cnpj") && seq.includes("tempo_empresa"));
    }
  });
}

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
