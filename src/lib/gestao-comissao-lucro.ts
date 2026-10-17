import {
  lucroLiquidoAntesComissaoAuto,
  margemPctAntesComissaoAuto,
  type DespesaComOrigem,
} from "../../supabase/functions/_shared/gestao-lucro-comissao-base.ts";

export function comissaoLucroBase(input: {
  valorCompra: number | null;
  valorVenda: number;
  despesas: DespesaComOrigem[];
}): { lucroLiquido: number | null; margemPct: number | null } {
  const lucroLiquido = lucroLiquidoAntesComissaoAuto(input);
  const margemPct = margemPctAntesComissaoAuto(lucroLiquido, input.valorVenda);
  return { lucroLiquido, margemPct };
}
