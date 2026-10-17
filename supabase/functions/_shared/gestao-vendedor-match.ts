export type GestaoVendedorRow = {
  id: string;
  nome: string;
  ativo: boolean;
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function vendedorHintFromText(text: string): string {
  const t = text.replace(/\s+/g, " ");
  const m = t.match(/\bvendedor\s+([a-zà-ú\s]{2,40})/i);
  if (m) return m[1].trim();
  const m2 = t.match(/\b(vendido\s+por|vendedora?)\s+([a-zà-ú\s]{2,40})/i);
  if (m2) return m2[2].trim();
  return "";
}

export function matchGestaoVendedor(
  hint: string,
  vendedores: GestaoVendedorRow[],
): GestaoVendedorRow | null {
  const h = norm(hint);
  if (!h) return null;
  const active = vendedores.filter((v) => v.ativo);
  const exact = active.find((v) => norm(v.nome) === h);
  if (exact) return exact;
  const starts = active.filter((v) => norm(v.nome).startsWith(h) || h.startsWith(norm(v.nome)));
  if (starts.length === 1) return starts[0];
  const includes = active.filter((v) => norm(v.nome).includes(h) || h.includes(norm(v.nome)));
  if (includes.length === 1) return includes[0];
  return null;
}
