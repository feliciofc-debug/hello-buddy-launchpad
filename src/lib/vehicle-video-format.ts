export function formatTelefoneBR(raw: string): string {
  const limpo = raw.trim();
  if (!limpo) return "";
  const d = limpo.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return limpo;
}
