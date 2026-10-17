import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFocusNfePayload, maskCpfCnpj } from "./gestao-nfe-build.ts";
import { defaultGestaoNfeOperacoes } from "./gestao-nfe-config-default.ts";

Deno.test("buildFocusNfePayload saida venda", () => {
  const op = defaultGestaoNfeOperacoes().saida_venda!;
  const payload = buildFocusNfePayload({
    tipo: "saida_venda",
    emitente: {
      cnpj: "12.345.678/0001-99",
      inscricao_estadual: "123",
      regime_tributario: "simples_nacional",
      razao_social: "Loja Teste LTDA",
      nome_fantasia: "Loja",
      logradouro: "Rua A",
      numero: "10",
      complemento: null,
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01000-000",
    },
    operacao: op,
    veiculo: { marca: "Honda", modelo: "Civic", placa: "ABC1D23" },
    valorTotal: 85000,
    tomador: {
      nome: "Cliente",
      cpf_cnpj: "12345678901",
      logradouro: "Rua B",
      numero: "2",
      bairro: "B",
      municipio: "SP",
      uf: "SP",
      cep: "01001000",
    },
  });
  assertEquals(payload.tipo_documento, "1");
  assertEquals((payload.items as Record<string, unknown>[])[0].cfop, "5102");
});

Deno.test("maskCpfCnpj oculta documento", () => {
  assertEquals(maskCpfCnpj("12345678901").includes("***"), true);
});

Deno.test("buildFocusNfePayload exige cfop", () => {
  const op = { ...defaultGestaoNfeOperacoes().saida_venda!, cfop: "" };
  assertThrows(() => buildFocusNfePayload({
    tipo: "saida_venda",
    emitente: {
      cnpj: "12345678000199",
      inscricao_estadual: "1",
      regime_tributario: "",
      razao_social: "X",
      nome_fantasia: "X",
      logradouro: "R",
      numero: "1",
      complemento: null,
      bairro: "B",
      municipio: "M",
      uf: "SP",
      cep: "01001000",
    },
    operacao: op,
    veiculo: { marca: "A", modelo: "B" },
    valorTotal: 1,
    tomador: {
      nome: "C",
      cpf_cnpj: "12345678901",
      logradouro: "R",
      numero: "1",
      bairro: "B",
      municipio: "M",
      uf: "SP",
      cep: "01001000",
    },
  }));
});
