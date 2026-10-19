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
  const m3 = t.match(/\bcomo\s+(?:esta|ta|está)\s+(?:a|o)?\s*([a-zà-ú][a-zà-ú\s]{1,38})/i);
  if (m3) {
    const name = m3[1].trim().replace(/\s+(da|do|de|loja)\b.*$/i, "").trim();
    if (name.length >= 2 && !/^loja$/i.test(name) && !/^equipe$/i.test(name)) return name;
  }
  const m4 = t.match(/\bvendas?\s+do(a)?\s+([a-zà-ú][a-zà-ú\s]{1,38})/i);
  if (m4) return m4[2].trim().replace(/\s+(da|do|de|loja)\b.*$/i, "").trim();
  const m5 = t.match(/\brelatorio\s+do(a)?\s+([a-zà-ú][a-zà-ú\s]{1,38})/i);
  if (m5) return m5[2].trim().replace(/\s+(da|do|de|loja)\b.*$/i, "").trim();
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
