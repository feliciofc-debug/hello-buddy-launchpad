/** Espelha supabase/functions/_shared/video-produto-veiculo.ts para testes locais. */

export function quebrarTituloVeiculo(nome: string, maxLinhas = 2): string[] {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [""];
  if (palavras.length === 1 || maxLinhas <= 1) return [palavras.join(" ")];

  let melhor: [string, string] | null = null;
  let melhorDiff = Infinity;
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(" ");
    const b = palavras.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < melhorDiff) {
      melhorDiff = diff;
      melhor = [a, b];
    }
  }
  return melhor ?? [palavras.join(" ")];
}

export function tamanhoFonteTituloVeiculo(linhas: string[]): number {
  const maior = Math.max(...linhas.map((l) => l.length), 1);
  if (linhas.length <= 1) {
    if (maior <= 16) return 72;
    if (maior <= 22) return 64;
    if (maior <= 28) return 56;
    return 48;
  }
  if (maior <= 14) return 58;
  if (maior <= 20) return 52;
  if (maior <= 26) return 46;
  return 40;
}

export function formatPrecoExibicao(preco?: string): string {
  const bruto = String(preco ?? "").trim();
  if (!bruto) return "";
  if (bruto.startsWith("R$")) return bruto;
  return bruto;
}
