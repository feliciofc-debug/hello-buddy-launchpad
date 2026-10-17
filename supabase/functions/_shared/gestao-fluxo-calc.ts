export type GestaoContaFluxo = {
  id: string;
  tipo: "pagar" | "receber";
  valor: number;
  vencimento: string;
  pago_em: string | null;
  recebido_em: string | null;
  recorrencia_dia_mes: number | null;
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

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function isSettled(c: GestaoContaFluxo): boolean {
  return c.tipo === "pagar" ? !!c.pago_em : !!c.recebido_em;
}

/** Expande recorrências nos próximos `monthsAhead` meses (virtual, id suffix -rec). */
export function expandRecorrencias(
  contas: GestaoContaFluxo[],
  from: Date,
  monthsAhead = 3,
): GestaoContaFluxo[] {
  const out = [...contas];
  const end = new Date(from.getFullYear(), from.getMonth() + monthsAhead + 1, 0);
  for (const c of contas) {
    if (!c.recorrencia_dia_mes) continue;
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= end) {
      const day = Math.min(
        c.recorrencia_dia_mes,
        new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(),
      );
      const venc = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const vencIso = iso(venc);
      if (venc >= from && !contas.some((x) => x.vencimento === vencIso && x.id === c.id)) {
        out.push({
          ...c,
          id: `${c.id}-rec-${vencIso}`,
          vencimento: vencIso,
          pago_em: null,
          recebido_em: null,
        });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return out;
}

export function calcFluxoDiario(
  contas: GestaoContaFluxo[],
  start: string,
  end: string,
  now = new Date(),
): GestaoFluxoDia[] {
  const expanded = expandRecorrencias(contas, now);
  const days: GestaoFluxoDia[] = [];
  let cursor = new Date(start);
  const endD = new Date(end);
  let saldo = 0;

  while (cursor <= endD) {
    const data = iso(cursor);
    let entradas = 0;
    let saidas = 0;
    let previstoEntradas = 0;
    let previstoSaidas = 0;

    for (const c of expanded) {
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
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function calcSaldoProjetado(
  contas: GestaoContaFluxo[],
  dias: 30 | 60 | 90,
  now = new Date(),
): GestaoFluxoProjecao {
  const start = iso(now);
  const end = iso(addDays(now, dias));
  const expanded = expandRecorrencias(contas, now);
  let entradasPrevistas = 0;
  let saidasPrevistas = 0;

  for (const c of expanded) {
    if (isSettled(c)) continue;
    if (c.vencimento < start || c.vencimento > end) continue;
    if (c.tipo === "receber") entradasPrevistas += c.valor;
    else saidasPrevistas += c.valor;
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
