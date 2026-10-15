import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  advanceFinanciamentoAfterText,
  applyFinanciamentoTipoPessoa,
  buildRecadoFinanciamentoFichaSemPii,
  clienteNomeLooksComplete,
  mergePendingForFinanciamentoStart,
} from "./vehicle-stock-financiamento.ts";
import { assertLogRedactionHasNoCpf } from "./pii-log-sanitize.ts";

Deno.test("clienteNomeLooksComplete exige ao menos dois tokens", () => {
  assert(clienteNomeLooksComplete("Ana Silva"));
  assert(!clienteNomeLooksComplete("Ana"));
});

Deno.test("tipo PF com nome vitrine completo pula pergunta de nome", () => {
  const now = new Date().toISOString();
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
  }, now);
  const form = applyFinanciamentoTipoPessoa(
    {
      ...pending.form!,
      lgpd_aceite_em: now,
      step: "tipo_pessoa",
      updated_at: now,
    },
    "pf",
    { ...pending, cliente_nome: "Maria Souza" },
    now,
  );
  assertEquals(form.step, "cpf_cnpj");
  assertEquals(form.nome_completo, "Maria Souza");
});

Deno.test("recado financiamento sem PII sensível", () => {
  const recado = buildRecadoFinanciamentoFichaSemPii({
    clienteNome: "João",
    contactName: "João WA",
    fromNumber: "5521999999999",
    vehicle: {
      id: "v1",
      marca: "Honda",
      modelo: "Civic",
      versao: null,
      ano_fabricacao: 2020,
      ano_modelo: 2020,
      km: 1000,
      preco: 100000,
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
    },
    fichaId: "abc-123",
  });
  assert(recado.includes("abc-123"));
  assert(!recado.toLowerCase().includes("cpf"));
  assertLogRedactionHasNoCpf(recado);
});

Deno.test("CPF inválido não avança etapa", () => {
  const now = new Date().toISOString();
  const form = {
    flow: "financiamento" as const,
    step: "cpf_cnpj",
    veiculo_id: "v1",
    tipo_pessoa: "pf" as const,
    updated_at: now,
  };
  const r = advanceFinanciamentoAfterText(form, "11111111111", now, {});
  assertEquals(r.form.step, "cpf_cnpj");
  assert(r.reply?.includes("CPF"));
});
