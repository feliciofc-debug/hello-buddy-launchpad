import { calcDreMes } from "../../supabase/functions/_shared/gestao-dre-calc.ts";
import {
  contasToDreOperacional,
  veiculosToDreVendas,
  type GestaoContaLancamento,
} from "@/lib/gestao-financeiro-load.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import type { GestaoNfeRow } from "@/lib/gestao-nfe-load.ts";

export function shiftCompetencia(competencia: string, deltaMonths: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function competenciaLabelPt(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function competenciaShortLabelPt(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

export type GestaoResultadoMesMetrics = {
  dre: ReturnType<typeof calcDreMes>;
  margemMediaPct: number | null;
  lucroExibido: number;
  lucroLegenda: string | null;
  nfesEmitidas: number;
  vendasComNfeAlvo: number;
};

export function computeGestaoResultadoMes(
  competencia: string,
  veiculos: GestaoVeiculoEnriched[],
  contas: GestaoContaLancamento[],
  nfes: GestaoNfeRow[] = [],
): GestaoResultadoMesMetrics {
  const vendas = veiculosToDreVendas(veiculos);
  const operacionais = contasToDreOperacional(contas);
  const dre = calcDreMes(competencia, vendas, operacionais);

  const vendidosMes = veiculos.filter(
    (v) => v.dataVenda && v.dataVenda.startsWith(competencia),
  );
  const margens = vendidosMes
    .map((v) => v.lucro.margemPct)
    .filter((m): m is number => m != null && Number.isFinite(m));
  const margemMediaPct = margens.length
    ? margens.reduce((a, b) => a + b, 0) / margens.length
    : null;

  const semDespesasOp = dre.despesasOperacionais === 0;
  const lucroExibido = semDespesasOp ? dre.lucroCarros : dre.lucroLiquidoLoja;
  const lucroLegenda = semDespesasOp
    ? "Sem despesas operacionais lançadas — lucro dos carros"
    : null;

  const nfesMes = nfes.filter((n) => {
    const ref = (n.authorized_at ?? n.created_at).slice(0, 7);
    return ref === competencia && n.tipo_operacao === "saida_venda";
  });
  const nfesEmitidas = nfesMes.filter((n) =>
    n.status === "autorizada" || n.status === "processando"
  ).length;

  return {
    dre,
    margemMediaPct,
    lucroExibido,
    lucroLegenda,
    nfesEmitidas,
    vendasComNfeAlvo: dre.qtdVendas,
  };
}

export function compareDelta(current: number, previous: number): {
  diff: number;
  pct: number | null;
  improved: boolean;
} {
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : null;
  return { diff, pct, improved: diff >= 0 };
}
