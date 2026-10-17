import { supabase } from "@/integrations/supabase/client";
import {
  assignExtratoDedupeOccurrences,
  dedupeKeyFromFitid,
  dedupeKeyFromHash,
  hashExtratoDedupe,
} from "../../supabase/functions/_shared/gestao-extrato-dedupe.ts";
import { atribuirAutoMatchesGreedy, refKeyCandidato } from "../../supabase/functions/_shared/gestao-conciliacao-match.ts";
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
  match_liquidacao_snapshot?: Record<string, unknown> | null;
};

export type GestaoMatchLiquidacaoSnapshot = {
  alterou_liquidacao: boolean;
  pago_em_anterior?: string | null;
  recebido_em_anterior?: string | null;
  comissao_pago_anterior?: string | null;
  comissao_valor_pago_anterior?: number | null;
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
  const comOcc = assignExtratoDedupeOccurrences(linhas);
  let inseridas = 0;
  let ignoradas = 0;
  for (const l of comOcc) {
    const hash = hashExtratoDedupe(l.data, l.descricao, l.valor, l.sentido);
    const dedupe_key = l.fitid
      ? dedupeKeyFromFitid(userId, l.fitid)
      : dedupeKeyFromHash(userId, hash, l.dedupeOccurrence);
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
    .select("id, conta_bancaria_id, data, descricao, valor, sentido, status, match_tipo, match_ref_id, match_score, match_liquidacao_snapshot")
    .eq("user_id", userId)
    .eq("conta_bancaria_id", contaId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: true });
  return (data ?? []) as GestaoExtratoTransacao[];
}

async function buildLiquidacaoSnapshot(
  match: { tipo: string; refId: string },
): Promise<GestaoMatchLiquidacaoSnapshot> {
  if (match.tipo === "conta_pagar") {
    const { data } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
      .select("pago_em").eq("id", match.refId).maybeSingle();
    const anterior = (data as { pago_em?: string | null } | null)?.pago_em ?? null;
    if (anterior) return { alterou_liquidacao: false, pago_em_anterior: anterior };
    return { alterou_liquidacao: true, pago_em_anterior: null };
  }
  if (match.tipo === "conta_receber") {
    const { data } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
      .select("recebido_em").eq("id", match.refId).maybeSingle();
    const anterior = (data as { recebido_em?: string | null } | null)?.recebido_em ?? null;
    if (anterior) return { alterou_liquidacao: false, recebido_em_anterior: anterior };
    return { alterou_liquidacao: true, recebido_em_anterior: null };
  }
  if (match.tipo === "comissao_extrato") {
    const { data } = await supabase.from("gestao_comissao_extrato" as "veiculos_estoque")
      .select("pago_em, valor_pago").eq("id", match.refId).maybeSingle();
    const row = data as { pago_em?: string | null; valor_pago?: number | null } | null;
    const anterior = row?.pago_em ?? null;
    if (anterior) {
      return {
        alterou_liquidacao: false,
        comissao_pago_anterior: anterior,
        comissao_valor_pago_anterior: row?.valor_pago ?? null,
      };
    }
    return { alterou_liquidacao: true, comissao_pago_anterior: null, comissao_valor_pago_anterior: null };
  }
  return { alterou_liquidacao: false };
}

export async function conciliarExtrato(
  userId: string,
  extratoId: string,
  match: { tipo: string; refId: string; score: number; valor: number },
  dataLiquidacao: string,
): Promise<void> {
  const { data: ocupado } = await supabase.from("gestao_extrato_transacao" as "veiculos_estoque")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "conciliado")
    .eq("match_tipo", match.tipo)
    .eq("match_ref_id", match.refId)
    .neq("id", extratoId)
    .maybeSingle();
  if (ocupado) throw new Error("candidato_ja_vinculado");

  const snapshot = await buildLiquidacaoSnapshot(match, dataLiquidacao);

  await supabase.from("gestao_extrato_transacao" as "veiculos_estoque").update({
    status: "conciliado",
    match_tipo: match.tipo,
    match_ref_id: match.refId,
    match_score: match.score,
    conciliado_em: new Date().toISOString(),
    match_liquidacao_snapshot: snapshot,
  }).eq("id", extratoId).eq("user_id", userId);

  if (match.tipo === "conta_pagar" && snapshot.alterou_liquidacao) {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({ pago_em: dataLiquidacao })
      .eq("id", match.refId).eq("user_id", userId);
  } else if (match.tipo === "conta_receber" && snapshot.alterou_liquidacao) {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({ recebido_em: dataLiquidacao })
      .eq("id", match.refId).eq("user_id", userId);
  } else if (match.tipo === "comissao_extrato" && snapshot.alterou_liquidacao) {
    await supabase.from("gestao_comissao_extrato" as "veiculos_estoque").update({
      pago_em: dataLiquidacao,
      valor_pago: match.valor,
    }).eq("id", match.refId).eq("user_id", userId);
  }
}

export async function desfazerConciliacao(userId: string, extratoId: string): Promise<void> {
  const { data: row } = await supabase.from("gestao_extrato_transacao" as "veiculos_estoque")
    .select("match_tipo, match_ref_id, match_liquidacao_snapshot")
    .eq("id", extratoId).eq("user_id", userId).maybeSingle();
  if (!row) throw new Error("extrato_nao_encontrado");
  const snap = row.match_liquidacao_snapshot as GestaoMatchLiquidacaoSnapshot | null;
  const tipo = row.match_tipo as string | null;
  const refId = row.match_ref_id as string | null;

  await supabase.from("gestao_extrato_transacao" as "veiculos_estoque").update({
    status: "pendente",
    match_tipo: null,
    match_ref_id: null,
    match_score: null,
    conciliado_em: null,
    match_liquidacao_snapshot: null,
  }).eq("id", extratoId).eq("user_id", userId);

  if (!snap?.alterou_liquidacao || !tipo || !refId) return;

  if (tipo === "conta_pagar") {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({
      pago_em: snap.pago_em_anterior ?? null,
    }).eq("id", refId).eq("user_id", userId);
  } else if (tipo === "conta_receber") {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({
      recebido_em: snap.recebido_em_anterior ?? null,
    }).eq("id", refId).eq("user_id", userId);
  } else if (tipo === "comissao_extrato") {
    await supabase.from("gestao_comissao_extrato" as "veiculos_estoque").update({
      pago_em: snap.comissao_pago_anterior ?? null,
      valor_pago: snap.comissao_valor_pago_anterior ?? null,
    }).eq("id", refId).eq("user_id", userId);
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
  const atribuidos = atribuirAutoMatchesGreedy(extratos);
  let n = 0;
  for (const a of atribuidos) {
    const e = extratos.find((x) => x.id === a.extratoId);
    if (!e) continue;
    await conciliarExtrato(userId, a.extratoId, {
      tipo: a.sug.candidato.tipo,
      refId: a.sug.candidato.refId,
      score: a.sug.score,
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
  const refsUsados = new Set<string>();
  let n = 0;
  for (const e of extratos) {
    if (e.status !== "pendente") continue;
    const top = e.sugestoes.find((s) => !refsUsados.has(refKeyCandidato(s.candidato)));
    if (!top || top.auto) continue;
    await marcarExtratoConfirmar(userId, e.id, {
      tipo: top.candidato.tipo,
      refId: top.candidato.refId,
      score: top.score,
    });
    refsUsados.add(refKeyCandidato(top.candidato));
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
