import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAdminClientInput } from "../../../src/lib/admin-client-validation.ts";

const ALLOWED_TYPES = ["empresa", "afiliado", "b2b", "revenda_veiculos"];

Deno.test("criação de cliente aceita dados válidos", () => {
  assertEquals(
    validateAdminClientInput({
      email: "cliente@empresa.com.br",
      password: "senha-segura",
      name: "Cliente Empresa",
      type: "empresa",
    }, ALLOWED_TYPES),
    {},
  );
});

Deno.test("criação de cliente aceita o tipo revenda de veículos", () => {
  assertEquals(
    validateAdminClientInput({
      email: "revenda@empresa.com.br",
      password: "senha-segura",
      name: "Revenda Premium",
      type: "revenda_veiculos",
    }, ALLOWED_TYPES),
    {},
  );
});

Deno.test("criação de cliente valida e-mail, senha, nome e tipo", () => {
  assertEquals(
    validateAdminClientInput({
      email: "email-invalido",
      password: "curta",
      name: " ",
      type: "desconhecido",
    }, ALLOWED_TYPES),
    {
      email: "Informe um e-mail válido.",
      password: "A senha deve ter pelo menos 8 caracteres.",
      name: "Informe o nome do cliente.",
      type: "Selecione um tipo de cliente válido.",
    },
  );
});
