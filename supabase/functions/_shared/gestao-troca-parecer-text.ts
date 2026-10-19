/** Valida que parágrafo da IA não introduz números ausentes nos fatos. */

export function extrairNumerosTexto(texto: string): number[] {
  const matches = texto.match(/\d[\d.,]*/g) ?? [];
  return matches
    .map((m) => Number(m.replace(/\./g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

export function parecerTextoSemNumerosInventados(
  paragrafo: string,
  fatosNumeros: number[],
): boolean {
  const permitidos = new Set(fatosNumeros.filter((n) => n > 0));
  for (const n of extrairNumerosTexto(paragrafo)) {
    if (!permitidos.has(n) && !permitidos.has(Math.round(n))) return false;
  }
  return true;
}

export function coletarNumerosFatos(fatos: Record<string, unknown>): number[] {
  const nums: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    else if (typeof v === "string") nums.push(...extrairNumerosTexto(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(fatos);
  return nums;
}
