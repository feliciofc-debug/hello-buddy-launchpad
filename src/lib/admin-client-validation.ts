export type AdminClientInput = {
  email: string;
  password: string;
  name: string;
  type: string;
};

export type AdminClientValidation = {
  email?: string;
  password?: string;
  name?: string;
  type?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAdminClientInput(
  input: AdminClientInput,
  allowedTypes: string[],
): AdminClientValidation {
  const errors: AdminClientValidation = {};
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }
  if (input.password.length < 8) {
    errors.password = "A senha deve ter pelo menos 8 caracteres.";
  }
  if (!input.name.trim()) {
    errors.name = "Informe o nome do cliente.";
  }
  if (!allowedTypes.includes(input.type)) {
    errors.type = "Selecione um tipo de cliente válido.";
  }
  return errors;
}
