export type ConsignacaoDespesa = {
  valor: number;
  descontarDoConsignante: boolean;
};

export type ConsignacaoCalcInput = {
  preco: number;
  valorGarantidoDono: number;
  pctLojaExcedente: number;
  pisoLoja: number | null;
  despesas: ConsignacaoDespesa[];
  comissaoVendedor: number;
};

export type ConsignacaoCalcResult = {
  parteLoja: number;
  parteDono: number;
  despesasDescontaveisDono: number;
  despesasNaoDescontaveis: number;
  repasseDonoLiquido: number;
  lucroLoja: number;
  abaixoDoGarantido: boolean;
};

const money = (value: number): number => Math.round(value * 100) / 100;
const nonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Divide uma venda consignada entre loja e dono.
 * O valor garantido nunca é tratado como capital/custo da loja.
 */
export function calcularConsignacao(
  input: ConsignacaoCalcInput,
): ConsignacaoCalcResult {
  const preco = nonNegative(input.preco);
  const garantido = nonNegative(input.valorGarantidoDono);
  const pct = Math.min(100, nonNegative(input.pctLojaExcedente));
  const piso = nonNegative(input.pisoLoja ?? 0);
  const parteLoja = money(Math.max((preco - garantido) * pct / 100, piso));
  const parteDono = money(preco - parteLoja);

  let despesasDescontaveisDono = 0;
  let despesasNaoDescontaveis = 0;
  for (const despesa of input.despesas) {
    const valor = nonNegative(Number(despesa.valor));
    if (despesa.descontarDoConsignante) despesasDescontaveisDono += valor;
    else despesasNaoDescontaveis += valor;
  }

  despesasDescontaveisDono = money(despesasDescontaveisDono);
  despesasNaoDescontaveis = money(despesasNaoDescontaveis);
  return {
    parteLoja,
    parteDono,
    despesasDescontaveisDono,
    despesasNaoDescontaveis,
    repasseDonoLiquido: money(parteDono - despesasDescontaveisDono),
    lucroLoja: money(
      parteLoja - despesasNaoDescontaveis -
        nonNegative(input.comissaoVendedor),
    ),
    abaixoDoGarantido: parteDono < garantido,
  };
}
