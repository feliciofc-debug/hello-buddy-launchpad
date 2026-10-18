import { addDiasYmd, formatYmdSaoPaulo } from "./gestao-date-br.ts";
import type { GestaoSerieProjecao } from "./gestao-recorrencia-sync.ts";
import { projectSeriesAposProximoMes } from "./gestao-recorrencia-sync.ts";

export type GestaoContaFluxo = {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;
  vencimento: string;
  pago_em: string | null;
  recebido_em: string | null;
  serie_id?: string | null;
  competencia?: string | null;
};

export type GestaoFluxoDia = {
  data: string;
  entradas: number;
  saidas: number;
  saldoDia: number;
  previstoEntradas: number;
  previstoSaidas: number;
};

export type GestaoFluxoProjecao = {
  dias: number;
  saldoProjetado: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
};

function isSettled(c: GestaoContaFluxo): boolean {
  return c.tipo === "pagar" ? !!c.pago_em : !!c.recebido_em;
}

export function calcFluxoDiario(
  contas: GestaoContaFluxo[],
  start: string,
  end: string,
): GestaoFluxoDia[] {
  const days: GestaoFluxoDia[] = [];
  let data = start;
  let saldo = 0;

  while (data <= end) {
    let entradas = 0;
    let saidas = 0;
    let previstoEntradas = 0;
    let previstoSaidas = 0;

    for (const c of contas) {
      if (c.tipo === "receber") {
        if (c.recebido_em === data) entradas += c.valor;
        else if (!c.recebido_em && c.vencimento === data) previstoEntradas += c.valor;
      } else {
        if (c.pago_em === data) saidas += c.valor;
        else if (!c.pago_em && c.vencimento === data) previstoSaidas += c.valor;
      }
    }

    saldo += entradas - saidas;
    days.push({
      data,
      entradas: round2(entradas),
      saidas: round2(saidas),
      saldoDia: round2(saldo),
      previstoEntradas: round2(previstoEntradas),
      previstoSaidas: round2(previstoSaidas),
    });
    data = addDiasYmd(data, 1);
  }
  return days;
}

export function calcSaldoProjetado(
  contas: GestaoContaFluxo[],
  dias: 30 | 60 | 90,
  now = new Date(),
  series: GestaoSerieProjecao[] = [],
): GestaoFluxoProjecao {
  const start = formatYmdSaoPaulo(now);
  const end = addDiasYmd(start, dias);
  let entradasPrevistas = 0;
  let saidasPrevistas = 0;

  for (const c of contas) {
    if (isSettled(c)) continue;
    if (c.vencimento < start || c.vencimento > end) continue;
    if (c.tipo === "receber") entradasPrevistas += c.valor;
    else saidasPrevistas += c.valor;
  }

  const existingKeys = new Set(
    contas
      .filter((c) => c.serie_id && c.competencia)
      .map((c) => `${c.serie_id}:${c.competencia}`),
  );
  const virtuais = projectSeriesAposProximoMes(series, existingKeys, now, end);
  for (const v of virtuais) {
    if (v.vencimento < start || v.vencimento > end) continue;
    if (v.tipo === "receber") entradasPrevistas += v.valor;
    else saidasPrevistas += v.valor;
  }

  return {
    dias,
    entradasPrevistas: round2(entradasPrevistas),
    saidasPrevistas: round2(saidasPrevistas),
    saldoProjetado: round2(entradasPrevistas - saidasPrevistas),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
