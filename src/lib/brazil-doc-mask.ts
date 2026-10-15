export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function maskCpfForDisplay(cpf: string): string {
  const d = digitsOnly(cpf);
  if (d.length !== 11) return "***";
  return `***.***.${d.slice(6, 9)}-**`;
}

export function maskCnpjForDisplay(cnpj: string): string {
  const d = digitsOnly(cnpj);
  if (d.length !== 14) return "***";
  return `**.***.***/${d.slice(8, 12)}-**`;
}
