import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isValidCnpj,
  validateAmzAutoCadastro,
  whatsappToE164BR,
} from "../_shared/amz-auto-cadastro-validate.ts";

const validBase = {
  loja_nome: "Prime Veículos",
  cnpj: "22.003.550/0001-05",
  responsavel: "João",
  whatsapp: "(21) 99999-9999",
  email: "joao@prime.com.br",
  cidade_uf: "Rio de Janeiro / RJ",
  tipo_operacao: "revenda",
  qtd_lojas: "1 loja",
  faixa_estoque: "Até 30",
  interesse: "Tudo",
  aceite_termos: true,
};

Deno.test("CNPJ válido passa dígito verificador", () => {
  assertEquals(isValidCnpj("22.003.550/0001-05"), true);
  assertEquals(isValidCnpj("00000000000000"), false);
  assertEquals(isValidCnpj("123"), false);
});

Deno.test("WhatsApp BR vira E.164", () => {
  assertEquals(whatsappToE164BR("(21) 99999-9999"), "+5521999999999");
  assertEquals(whatsappToE164BR("11988887777"), "+5511988887777");
  assertEquals(whatsappToE164BR("123"), null);
});

Deno.test("honeypot preenchido é rejeitado", () => {
  const result = validateAmzAutoCadastro({
    ...validBase,
    website: "http://spam.test",
  });
  assertEquals(result.ok, false);
});

Deno.test("campos obrigatórios", () => {
  const result = validateAmzAutoCadastro({});
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(typeof result.error, "string");
  }
});

Deno.test("cadastro completo válido", () => {
  const result = validateAmzAutoCadastro(validBase);
  assertEquals(result.ok, true);
});

Deno.test("rejeita campo não-string", () => {
  const result = validateAmzAutoCadastro({
    ...validBase,
    loja_nome: 123,
  });
  assertEquals(result.ok, false);
});

Deno.test("rejeita nome da loja acima do limite", () => {
  const result = validateAmzAutoCadastro({
    ...validBase,
    loja_nome: "x".repeat(121),
  });
  assertEquals(result.ok, false);
});

Deno.test("rejeita opção de interesse fora da lista", () => {
  const result = validateAmzAutoCadastro({
    ...validBase,
    interesse: "Outra coisa",
  });
  assertEquals(result.ok, false);
});

Deno.test("rejeita faixa de estoque fora da lista", () => {
  const result = validateAmzAutoCadastro({
    ...validBase,
    faixa_estoque: "999 carros",
  });
  assertEquals(result.ok, false);
});
