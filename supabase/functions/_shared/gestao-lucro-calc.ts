export type GestaoDespesaLine = { valor: number; categoria?: string };

export type GestaoLucroInput = {
  valorCompra: number | null;
  despesas: GestaoDespesaLine[];
  valorVenda: number | null;
  precoAnunciado: number | null;
  dataCompra: string | null;
  dataVenda: string | null;
  statusVeiculo: string;
};

export type GestaoLucroResult = {
  totalDespesas: number;
  investido: number;
  lucroBruto: number | null;
  lucroLiquido: number | null;
  margemPct: number | null;
  diasEstoque: number | null;
  lucroProjetado: number | null;
  vendido: boolean;
};

function sumDespesas(despesas: GestaoDespesaLine[]): number {
  return despesas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
}

function daysBetween(start: string, end: string): number | null {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

export function calcGestaoLucro(input: GestaoLucroInput): GestaoLucroResult {
  const compra = input.valorCompra ?? 0;
  const totalDespesas = sumDespesas(input.despesas);
  const investido = compra + totalDespesas;
  const vendido = input.statusVeiculo === "vendido" || input.valorVenda != null;
  const venda = input.valorVenda;

  let lucroBruto: number | null = null;
  let lucroLiquido: number | null = null;
  let margemPct: number | null = null;
  let lucroProjetado: number | null = null;

  if (venda != null && venda > 0) {
    lucroBruto = venda - compra;
    lucroLiquido = venda - investido;
    margemPct = (lucroLiquido / venda) * 100;
  } else if (input.precoAnunciado != null && input.precoAnunciado > 0) {
    lucroProjetado = input.precoAnunciado - investido;
  }

  const endDate = input.dataVenda ?? new Date().toISOString().slice(0, 10);
  const diasEstoque = input.dataCompra
    ? daysBetween(input.dataCompra, endDate)
    : null;

  return {
    totalDespesas,
    investido,
    lucroBruto,
    lucroLiquido,
    margemPct,
    diasEstoque,
    lucroProjetado,
    vendido,
  };
}

export function placaFinalLabel(placa: string | null | undefined): string | null {
  const p = (placa ?? "").replace(/\W/g, "").toUpperCase();
  if (p.length < 4) return null;
  return p.slice(-4);
}
