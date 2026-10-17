import {
  planRecorrenciaLancamentos,
  type GestaoRecorrenciaSerie,
} from "./gestao-recorrencia-sync.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export async function syncRecorrenciaLancamentosDb(client: Db, userId: string): Promise<void> {
  const { data: seriesRows } = await client.from("gestao_conta_recorrencia_serie")
    .select("id, tipo, categoria_operacional, valor, dia_mes, forma_pagamento, observacao, veiculo_id, encerrada_a_partir_de")
    .eq("user_id", userId);
  const series = (seriesRows ?? []) as GestaoRecorrenciaSerie[];
  if (!series.length) return;

  const { data: existingRows } = await client.from("gestao_conta_lancamento")
    .select("id, serie_id, competencia, pago_em, recebido_em")
    .eq("user_id", userId)
    .eq("origem", "recorrencia")
    .is("deleted_at", null);

  const existing = (existingRows ?? []).map((r: Record<string, unknown>) => ({
    serie_id: String(r.serie_id),
    competencia: String(r.competencia),
    id: String(r.id),
    pago_em: r.pago_em ? String(r.pago_em) : null,
    recebido_em: r.recebido_em ? String(r.recebido_em) : null,
  }));

  const plan = planRecorrenciaLancamentos(series, existing);
  for (const row of plan) {
    await client.from("gestao_conta_lancamento").insert({
      user_id: userId,
      tipo: row.tipo,
      categoria_operacional: row.categoria_operacional,
      valor: row.valor,
      vencimento: row.vencimento,
      forma_pagamento: row.forma_pagamento,
      observacao: row.observacao,
      veiculo_id: row.veiculo_id,
      origem: "recorrencia",
      serie_id: row.serie_id,
      competencia: row.competencia,
    });
  }
}
