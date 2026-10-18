export type GestaoComissaoGuardResult =
  | { ok: true; pctVenda: number }
  | { ok: false; code: "gte_venda" | "above_10pct"; message: string; pctVenda: number };

export function pctComissaoSobreVenda(comissao: number, valorVenda: number): number {
  if (valorVenda <= 0) return 0;
  return (comissao / valorVenda) * 100;
}

export function validateGestaoComissaoValor(
  comissao: number,
  valorVenda: number,
  opts?: { allowAbove10Pct?: boolean },
): GestaoComissaoGuardResult {
  const pctVenda = pctComissaoSobreVenda(comissao, valorVenda);
  if (valorVenda > 0 && comissao >= valorVenda) {
    return {
      ok: false,
      code: "gte_venda",
      message: "Comissão não pode ser igual ou maior que o valor da venda — confira o valor",
      pctVenda,
    };
  }
  if (valorVenda > 0 && comissao > valorVenda * 0.1 && !opts?.allowAbove10Pct) {
    return {
      ok: false,
      code: "above_10pct",
      message: "Comissão acima de 10% da venda — confira o valor",
      pctVenda,
    };
  }
  return { ok: true, pctVenda };
}
