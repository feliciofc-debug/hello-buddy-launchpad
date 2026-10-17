import type { GestaoConciliacaoCandidato } from "./gestao-conciliacao-match.ts";

export function candidatosFromContas(
  contas: Array<{
    id: string;
    tipo: string;
    valor: number;
    vencimento: string;
    observacao: string | null;
    categoria_operacional: string;
    pago_em: string | null;
    recebido_em: string | null;
  }>,
): GestaoConciliacaoCandidato[] {
  return contas.map((c) => ({
    tipo: c.tipo === "pagar" ? "conta_pagar" as const : "conta_receber" as const,
    refId: c.id,
    data: c.pago_em ?? c.recebido_em ?? c.vencimento,
    valor: Number(c.valor),
    descricao: c.observacao ?? c.categoria_operacional,
    liquidado: !!(c.pago_em ?? c.recebido_em),
    categoria: c.categoria_operacional,
  }));
}

export function candidatosFromDespesas(
  despesas: Array<{ id: string; data: string; valor: number; descricao: string | null; categoria: string }>,
): GestaoConciliacaoCandidato[] {
  return despesas.map((d) => ({
    tipo: "veiculo_despesa",
    refId: d.id,
    data: d.data,
    valor: Number(d.valor),
    descricao: d.descricao ?? d.categoria,
    liquidado: false,
    categoria: d.categoria,
  }));
}

export function candidatosFromVendas(
  vendas: Array<{ veiculo_id: string; data_venda: string; valor_venda: number }>,
): GestaoConciliacaoCandidato[] {
  return vendas.map((v) => ({
    tipo: "veiculo_venda",
    refId: v.veiculo_id,
    data: v.data_venda,
    valor: Number(v.valor_venda),
    descricao: "Venda veículo",
    liquidado: true,
  }));
}

export function candidatosFromComissaoExtrato(
  rows: Array<{ id: string; competencia: string; valor_comissao: number; pago_em: string | null }>,
): GestaoConciliacaoCandidato[] {
  return rows.map((r) => ({
    tipo: "comissao_extrato",
    refId: r.id,
    data: r.pago_em ?? `${r.competencia}-28`,
    valor: Number(r.valor_comissao),
    descricao: `Comissão ${r.competencia}`,
    liquidado: !!r.pago_em,
  }));
}
