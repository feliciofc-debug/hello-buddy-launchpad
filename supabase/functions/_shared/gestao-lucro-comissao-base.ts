import { calcGestaoLucro, type GestaoDespesaLine } from "./gestao-lucro-calc.ts";

export type DespesaComOrigem = GestaoDespesaLine & {
  origem_lancamento?: string | null;
};

/** Despesas que entram na base do lucro para cálculo de comissão (% sobre lucro). */
export function despesasParaBaseComissao<T extends DespesaComOrigem>(despesas: T[]): T[] {
  return despesas.filter((d) => d.origem_lancamento !== "automatica");
}

export function lucroLiquidoAntesComissaoAuto(input: {
  valorCompra: number | null;
  valorVenda: number;
  despesas: DespesaComOrigem[];
}): number | null {
  if (input.valorCompra == null) return null;
  const filtradas = despesasParaBaseComissao(input.despesas);
  const lucro = calcGestaoLucro({
    valorCompra: input.valorCompra,
    despesas: filtradas,
    valorVenda: input.valorVenda,
    precoAnunciado: null,
    dataCompra: null,
    dataVenda: null,
    statusVeiculo: "vendido",
  });
  return lucro.lucroLiquido;
}

export function margemPctAntesComissaoAuto(
  lucroLiquido: number | null,
  valorVenda: number,
): number | null {
  if (lucroLiquido == null || valorVenda <= 0) return null;
  return (lucroLiquido / valorVenda) * 100;
}
