import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isValidCnpj,
  validateAmzAutoCadastro,
  whatsappToE164BR,
} from "../_shared/amz-auto-cadastro-validate.ts";

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
    loja_nome: "Loja",
    cnpj: "22.003.550/0001-05",
    responsavel: "Ana",
    whatsapp: "(21) 99999-9999",
    email: "a@b.com",
    cidade_uf: "RJ / RJ",
    tipo_operacao: "revenda",
    qtd_lojas: "1",
    faixa_estoque: "30",
    interesse: "tudo",
    aceite_termos: true,
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
  const result = validateAmzAutoCadastro({
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
  });
  assertEquals(result.ok, true);
});
