/** Apenas dígitos. */
export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const d = digitsOnly(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  return mod === Number(d[10]);
}

export function isValidCnpj(cnpj: string): boolean {
  const d = digitsOnly(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * w1[i];
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (d1 !== Number(d[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(d[i]) * w2[i];
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  return d2 === Number(d[13]);
}

export function normalizeCpf(cpf: string): string {
  return digitsOnly(cpf);
}

export function normalizeCnpj(cnpj: string): string {
  return digitsOnly(cnpj);
}

export function maskCpfForDisplay(cpf: string): string {
  const d = digitsOnly(cpf);
  if (d.length !== 11) return "***";
  return `***.***.${d.slice(6, 9)}-**`;
}

/** Resumo ao cliente: ***.***.123-45 */
export function maskCpfForClienteResumo(cpf: string): string {
  const d = digitsOnly(cpf);
  if (d.length !== 11) return "—";
  return `***.***.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function maskCnpjForDisplay(cnpj: string): string {
  const d = digitsOnly(cnpj);
  if (d.length !== 14) return "***";
  return `**.***.***/${d.slice(8, 12)}-**`;
}
