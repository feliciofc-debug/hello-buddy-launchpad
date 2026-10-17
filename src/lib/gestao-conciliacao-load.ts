import { supabase } from "@/integrations/supabase/client";
import {
  dedupeKeyFromFitid,
  dedupeKeyFromHash,
  hashExtratoDedupe,
} from "../../supabase/functions/_shared/gestao-extrato-dedupe.ts";
import type { GestaoExtratoLinha } from "../../supabase/functions/_shared/gestao-ofx-parse.ts";

export type GestaoContaBancaria = {
  id: string;
  banco_nome: string;
  apelido: string;
  ultimos_4: string;
};

export type GestaoExtratoTransacao = {
  id: string;
  conta_bancaria_id: string;
  data: string;
  descricao: string;
  valor: number;
  sentido: "debito" | "credito";
  status: string;
  match_tipo: string | null;
  match_ref_id: string | null;
  match_score: number | null;
};

export async function loadContasBancarias(userId: string): Promise<GestaoContaBancaria[]> {
  const { data } = await supabase.from("gestao_conta_bancaria" as "veiculos_estoque")
    .select("id, banco_nome, apelido, ultimos_4")
    .eq("user_id", userId)
    .order("apelido");
  return (data ?? []) as GestaoContaBancaria[];
}

export async function saveContaBancaria(
  userId: string,
  input: { banco_nome: string; apelido: string; ultimos_4: string },
): Promise<void> {
  const ultimos = input.ultimos_4.replace(/\D/g, "").slice(-4);
  if (ultimos.length !== 4) throw new Error("invalid_ultimos_4");
  const { error } = await supabase.from("gestao_conta_bancaria" as "veiculos_estoque").insert({
    user_id: userId,
    banco_nome: input.banco_nome.trim(),
    apelido: input.apelido.trim(),
    ultimos_4: ultimos,
  });
  if (error) throw new Error(error.message);
}

export async function importExtratoLinhas(
  userId: string,
  contaBancariaId: string,
  linhas: GestaoExtratoLinha[],
): Promise<{ inseridas: number; ignoradas: number }> {
  let inseridas = 0;
  let ignoradas = 0;
  for (const l of linhas) {
    const hash = hashExtratoDedupe(l.data, l.descricao, l.valor, l.sentido);
    const dedupe_key = l.fitid
      ? dedupeKeyFromFitid(userId, l.fitid)
      : dedupeKeyFromHash(userId, hash);
    const { error } = await supabase.from("gestao_extrato_transacao" as "veiculos_estoque").insert({
      user_id: userId,
      conta_bancaria_id: contaBancariaId,
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      sentido: l.sentido,
      dedupe_key,
      fitid: l.fitid,
      status: "pendente",
    });
    if (error) {
      if (error.code === "23505") ignoradas += 1;
      else throw new Error(error.message);
    } else inseridas += 1;
  }
  return { inseridas, ignoradas };
}

export async function loadExtratoTransacoes(
  userId: string,
  contaId: string,
  start: string,
  end: string,
): Promise<GestaoExtratoTransacao[]> {
  const { data } = await supabase.from("gestao_extrato_transacao" as "veiculos_estoque")
    .select("id, conta_bancaria_id, data, descricao, valor, sentido, status, match_tipo, match_ref_id, match_score")
    .eq("user_id", userId)
    .eq("conta_bancaria_id", contaId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: true });
  return (data ?? []) as GestaoExtratoTransacao[];
}

export async function conciliarExtrato(
  userId: string,
  extratoId: string,
  match: { tipo: string; refId: string; score: number; valor: number },
  dataLiquidacao: string,
): Promise<void> {
  await supabase.from("gestao_extrato_transacao" as "veiculos_estoque").update({
    status: "conciliado",
    match_tipo: match.tipo,
    match_ref_id: match.refId,
    match_score: match.score,
    conciliado_em: new Date().toISOString(),
  }).eq("id", extratoId).eq("user_id", userId);

  if (match.tipo === "conta_pagar") {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({ pago_em: dataLiquidacao })
      .eq("id", match.refId).eq("user_id", userId);
  } else if (match.tipo === "conta_receber") {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({ recebido_em: dataLiquidacao })
      .eq("id", match.refId).eq("user_id", userId);
  } else if (match.tipo === "comissao_extrato") {
    await supabase.from("gestao_comissao_extrato" as "veiculos_estoque").update({
      pago_em: dataLiquidacao,
      valor_pago: match.valor,
    }).eq("id", match.refId).eq("user_id", userId);
  }
}

export async function marcarExtratoConfirmar(
  userId: string,
  extratoId: string,
  match: { tipo: string; refId: string; score: number },
): Promise<void> {
  await supabase.from("gestao_extrato_transacao" as "veiculos_estoque").update({
    status: "confirmar",
    match_tipo: match.tipo,
    match_ref_id: match.refId,
    match_score: match.score,
  }).eq("id", extratoId).eq("user_id", userId);
}

export async function aplicarMatchAutomatico(
  userId: string,
  extratos: Array<{ id: string; data: string; valor: number; sugestoes: Array<{ auto: boolean; candidato: { tipo: string; refId: string }; score: number }> }>,
): Promise<number> {
  let n = 0;
  for (const e of extratos) {
    const top = e.sugestoes.find((s) => s.auto);
    if (!top) continue;
    await conciliarExtrato(userId, e.id, {
      tipo: top.candidato.tipo,
      refId: top.candidato.refId,
      score: top.score,
      valor: e.valor,
    }, e.data);
    n += 1;
  }
  return n;
}

/** Marca extratos ambíguos (sugestão sem auto-match) como `confirmar` no banco. */
export async function aplicarMarcadoresConfirmar(
  userId: string,
  extratos: Array<{
    id: string;
    status: string;
    sugestoes: Array<{ auto: boolean; candidato: { tipo: string; refId: string }; score: number }>;
  }>,
): Promise<number> {
  let n = 0;
  for (const e of extratos) {
    if (e.status !== "pendente") continue;
    const top = e.sugestoes[0];
    if (!top || top.auto) continue;
    await marcarExtratoConfirmar(userId, e.id, {
      tipo: top.candidato.tipo,
      refId: top.candidato.refId,
      score: top.score,
    });
    n += 1;
  }
  return n;
}

export async function countConciliacaoPendente(userId: string): Promise<{ qtd: number; valor: number }> {
  const { data } = await supabase.from("gestao_extrato_transacao" as "veiculos_estoque")
    .select("valor, status")
    .eq("user_id", userId)
    .in("status", ["pendente", "confirmar"]);
  const rows = data ?? [];
  return {
    qtd: rows.length,
    valor: rows.reduce((a, r) => a + Number(r.valor), 0),
  };
}
