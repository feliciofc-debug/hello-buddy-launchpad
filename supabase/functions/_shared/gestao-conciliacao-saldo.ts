export type GestaoContaSaldoLine = {
  tipo: string;
  valor: number;
  pago_em: string | null;
  recebido_em: string | null;
};

export type GestaoExtratoSaldoLine = {
  data: string;
  valor: number;
  sentido: "debito" | "credito";
  status: string;
  match_tipo: string | null;
};

/** Saldo liquidado no período: contas + vendas/despesas de carro conciliadas no extrato. */
export function calcSaldoSistemaPeriodo(
  contas: GestaoContaSaldoLine[],
  extratos: GestaoExtratoSaldoLine[],
  start: string,
  end: string,
): number {
  let s = 0;
  for (const c of contas) {
    if (c.tipo === "receber" && c.recebido_em && c.recebido_em >= start && c.recebido_em <= end) {
      s += Number(c.valor);
    }
    if (c.tipo === "pagar" && c.pago_em && c.pago_em >= start && c.pago_em <= end) {
      s -= Number(c.valor);
    }
  }
  for (const e of extratos) {
    if (e.status !== "conciliado" || e.data < start || e.data > end) continue;
    const v = Number(e.valor);
    if (e.match_tipo === "veiculo_venda") s += v;
    else if (e.match_tipo === "veiculo_despesa") s -= v;
  }
  return s;
}
