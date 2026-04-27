/**
 * Formata uma data (YYYY-MM-DD ou ISO) como dd/mm/yyyy no fuso local,
 * evitando o bug em que strings "YYYY-MM-DD" são interpretadas como UTC
 * meia-noite e acabam exibindo o dia anterior em fusos negativos (BR = UTC-3).
 */
export function formatDateBR(input: string | Date | null | undefined): string {
  if (!input) return '—';
  if (input instanceof Date) return input.toLocaleDateString('pt-BR');

  // Se vier só a parte de data (YYYY-MM-DD), parsear ao meio-dia local
  // para neutralizar qualquer timezone shift.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const safe = dateOnly ? `${input}T12:00:00` : input;
  const d = new Date(safe);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}
