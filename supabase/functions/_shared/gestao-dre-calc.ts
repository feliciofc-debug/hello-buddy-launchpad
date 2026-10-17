import { calcGestaoLucro, type GestaoDespesaLine } from "./gestao-lucro-calc.ts";

export type GestaoVendaDreLine = {
  veiculoId: string;
  dataVenda: string;
  valorVenda: number;
  valorCompra: number | null;
  despesas: GestaoDespesaLine[];
};

export type GestaoOperacionalDreLine = {
  categoria: string;
  valor: number;
  vencimento: string;
  pagoEm: string | null;
};

export type GestaoDreMes = {
  competencia: string;
  faturamento: number;
  custoCarros: number;
  despesasCarros: number;
  lucroCarros: number;
  despesasOperacionais: number;
  lucroLiquidoLoja: number;
  margemLiquidaPct: number | null;
  qtdVendas: number;
};

export function competenciaFromIsoDate(iso: string): string {
  return iso.slice(0, 7);
}

export function calcDreMes(
  competencia: string,
  vendas: GestaoVendaDreLine[],
  operacionais: GestaoOperacionalDreLine[],
): GestaoDreMes {
  const vendasMes = vendas.filter((v) => competenciaFromIsoDate(v.dataVenda) === competencia);
  let faturamento = 0;
  let custoCarros = 0;
  let despesasCarros = 0;

  for (const v of vendasMes) {
    faturamento += v.valorVenda;
    custoCarros += v.valorCompra ?? 0;
    despesasCarros += v.despesas.reduce((a, d) => a + d.valor, 0);
  }

  const lucroCarros = faturamento - custoCarros - despesasCarros;

  const opsMes = operacionais.filter((o) => {
    const ref = o.pagoEm ?? o.vencimento;
    return competenciaFromIsoDate(ref) === competencia;
  });
  const despesasOperacionais = opsMes.reduce((a, o) => a + o.valor, 0);
  const lucroLiquidoLoja = lucroCarros - despesasOperacionais;
  const margemLiquidaPct = faturamento > 0 ? (lucroLiquidoLoja / faturamento) * 100 : null;

  return {
    competencia,
    faturamento: round2(faturamento),
    custoCarros: round2(custoCarros),
    despesasCarros: round2(despesasCarros),
    lucroCarros: round2(lucroCarros),
    despesasOperacionais: round2(despesasOperacionais),
    lucroLiquidoLoja: round2(lucroLiquidoLoja),
    margemLiquidaPct: margemLiquidaPct != null ? round2(margemLiquidaPct) : null,
    qtdVendas: vendasMes.length,
  };
}

export function calcDreSerie(
  competencias: string[],
  vendas: GestaoVendaDreLine[],
  operacionais: GestaoOperacionalDreLine[],
): GestaoDreMes[] {
  return competencias.map((c) => calcDreMes(c, vendas, operacionais));
}

export function vendaToLucroLine(v: GestaoVendaDreLine) {
  return calcGestaoLucro({
    valorCompra: v.valorCompra,
    despesas: v.despesas,
    valorVenda: v.valorVenda,
    precoAnunciado: null,
    dataCompra: null,
    dataVenda: v.dataVenda,
    statusVeiculo: "vendido",
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
