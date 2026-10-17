import { supabase } from "@/integrations/supabase/client";
import { planBonusOperacionalUpserts } from "../../supabase/functions/_shared/gestao-bonus-operacional-sync.ts";
import {
  planAtualizacaoLancamentosFuturos,
  planRecorrenciaLancamentos,
  type GestaoRecorrenciaSerie,
} from "../../supabase/functions/_shared/gestao-recorrencia-sync.ts";
import type { GestaoContaFluxo } from "../../supabase/functions/_shared/gestao-fluxo-calc.ts";
import type { GestaoOperacionalDreLine, GestaoVendaDreLine } from "../../supabase/functions/_shared/gestao-dre-calc.ts";
import type { GestaoVeiculoEnriched } from "./gestao-lucro-types.ts";
import { competenciaFromDate } from "../../supabase/functions/_shared/gestao-meta-calc.ts";

export type GestaoContaLancamento = {
  id: string;
  tipo: "pagar" | "receber";
  categoria_operacional: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  recebido_em: string | null;
  forma_pagamento: string | null;
  recorrencia_dia_mes: number | null;
  observacao: string | null;
  veiculo_id: string | null;
  origem: string;
  bonus_mensal_id: string | null;
  comprovante_path: string | null;
  serie_id: string | null;
  competencia: string | null;
};

export type GestaoContaRecorrenciaSerie = GestaoRecorrenciaSerie & {
  created_at?: string;
};

export type GestaoContadorTokenRow = {
  id: string;
  competencia: string;
  expires_at: string;
  created_at: string;
  last_access_at: string | null;
  revogado_em: string | null;
};

export async function syncBonusOperacionalContas(userId: string): Promise<void> {
  const { data: bonuses } = await supabase.from("gestao_bonus_mensal" as "veiculos_estoque")
    .select("id, competencia, valor, motivo")
    .eq("user_id", userId);
  const { data: existing } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
    .select("id, bonus_mensal_id, valor, vencimento")
    .eq("user_id", userId)
    .eq("origem", "bonus_g2")
    .is("deleted_at", null);

  const plan = planBonusOperacionalUpserts(
    (bonuses ?? []).map((b) => ({
      id: String(b.id),
      competencia: String(b.competencia),
      valor: Number(b.valor),
      motivo: String(b.motivo),
    })),
    (existing ?? []).map((e) => ({
      id: String(e.id),
      bonus_mensal_id: e.bonus_mensal_id ? String(e.bonus_mensal_id) : null,
      valor: Number(e.valor),
      vencimento: String(e.vencimento),
    })),
  );

  for (const row of plan) {
    if (row.existingId) {
      await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({
        valor: row.valor,
        vencimento: row.vencimento,
        observacao: row.observacao,
      }).eq("id", row.existingId).eq("user_id", userId);
    } else {
      await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").insert({
        user_id: userId,
        tipo: "pagar",
        categoria_operacional: "bonus_vendedores",
        valor: row.valor,
        vencimento: row.vencimento,
        origem: "bonus_g2",
        bonus_mensal_id: row.bonus_mensal_id,
        observacao: row.observacao,
      });
    }
  }
}

export async function loadRecorrenciaSeries(userId: string): Promise<GestaoContaRecorrenciaSerie[]> {
  const { data } = await supabase.from("gestao_conta_recorrencia_serie" as "veiculos_estoque")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((s) => ({
    id: String(s.id),
    tipo: s.tipo as "pagar" | "receber",
    categoria_operacional: String(s.categoria_operacional),
    valor: Number(s.valor),
    dia_mes: Number(s.dia_mes),
    forma_pagamento: s.forma_pagamento ? String(s.forma_pagamento) : null,
    observacao: s.observacao ? String(s.observacao) : null,
    veiculo_id: s.veiculo_id ? String(s.veiculo_id) : null,
    encerrada_a_partir_de: s.encerrada_a_partir_de ? String(s.encerrada_a_partir_de) : null,
    created_at: String(s.created_at),
  }));
}

export async function syncRecorrenciaLancamentos(userId: string): Promise<void> {
  const series = await loadRecorrenciaSeries(userId);
  if (!series.length) return;

  const { data: existingRows } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
    .select("id, serie_id, competencia, pago_em, recebido_em")
    .eq("user_id", userId)
    .eq("origem", "recorrencia")
    .is("deleted_at", null);

  const existing = (existingRows ?? []).map((r) => ({
    serie_id: String(r.serie_id),
    competencia: String(r.competencia),
    id: String(r.id),
    pago_em: r.pago_em ? String(r.pago_em) : null,
    recebido_em: r.recebido_em ? String(r.recebido_em) : null,
  }));

  const plan = planRecorrenciaLancamentos(series, existing);
  for (const row of plan) {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").insert({
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

export async function createRecorrenciaSerie(
  userId: string,
  input: Omit<GestaoRecorrenciaSerie, "id" | "encerrada_a_partir_de">,
): Promise<void> {
  const { error } = await supabase.from("gestao_conta_recorrencia_serie" as "veiculos_estoque").insert({
    user_id: userId,
    tipo: input.tipo,
    categoria_operacional: input.categoria_operacional,
    valor: input.valor,
    dia_mes: input.dia_mes,
    forma_pagamento: input.forma_pagamento,
    observacao: input.observacao,
    veiculo_id: input.veiculo_id,
  });
  if (error) throw new Error(error.message);
  await syncRecorrenciaLancamentos(userId);
}

export async function updateRecorrenciaSerie(
  userId: string,
  serieId: string,
  patch: Partial<GestaoRecorrenciaSerie>,
): Promise<void> {
  await supabase.from("gestao_conta_recorrencia_serie" as "veiculos_estoque").update({
    valor: patch.valor,
    dia_mes: patch.dia_mes,
    forma_pagamento: patch.forma_pagamento,
    observacao: patch.observacao,
    categoria_operacional: patch.categoria_operacional,
  }).eq("id", serieId).eq("user_id", userId);

  const series = await loadRecorrenciaSeries(userId);
  const serie = series.find((s) => s.id === serieId);
  if (!serie) return;

  const { data: launches } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
    .select("id, serie_id, competencia, pago_em, recebido_em")
    .eq("user_id", userId)
    .eq("serie_id", serieId)
    .is("deleted_at", null);

  const fromComp = competenciaFromDate();
  const updates = planAtualizacaoLancamentosFuturos(
    serie,
    (launches ?? []).map((l) => ({
      serie_id: String(l.serie_id),
      competencia: String(l.competencia),
      id: String(l.id),
      pago_em: l.pago_em ? String(l.pago_em) : null,
      recebido_em: l.recebido_em ? String(l.recebido_em) : null,
    })),
    fromComp,
  );

  for (const u of updates) {
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({
      valor: u.valor,
      vencimento: u.vencimento,
      observacao: u.observacao,
    }).eq("id", u.id).eq("user_id", userId);
  }
  await syncRecorrenciaLancamentos(userId);
}

export async function encerrarRecorrenciaSerie(
  userId: string,
  serieId: string,
  aPartirDeCompetencia: string,
): Promise<void> {
  await supabase.from("gestao_conta_recorrencia_serie" as "veiculos_estoque").update({
    encerrada_a_partir_de: aPartirDeCompetencia,
  }).eq("id", serieId).eq("user_id", userId);

  await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("serie_id", serieId)
    .gte("competencia", aPartirDeCompetencia)
    .is("pago_em", null)
    .is("recebido_em", null);
}

export async function loadGestaoContas(userId: string): Promise<GestaoContaLancamento[]> {
  await syncBonusOperacionalContas(userId);
  await syncRecorrenciaLancamentos(userId);
  const { data } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });
  return (data ?? []) as GestaoContaLancamento[];
}

export function contasToFluxo(contas: GestaoContaLancamento[]): GestaoContaFluxo[] {
  return contas.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    valor: Number(c.valor),
    vencimento: c.vencimento,
    pago_em: c.pago_em,
    recebido_em: c.recebido_em,
    serie_id: c.serie_id,
    competencia: c.competencia,
  }));
}

export function veiculosToDreVendas(veiculos: GestaoVeiculoEnriched[]): GestaoVendaDreLine[] {
  return veiculos
    .filter((v) => v.dataVenda && v.valorVenda != null)
    .map((v) => ({
      veiculoId: v.id,
      dataVenda: v.dataVenda!,
      valorVenda: v.valorVenda!,
      valorCompra: v.valorCompra,
      despesas: v.despesas.map((d) => ({ valor: Number(d.valor), categoria: d.categoria })),
    }));
}

export function contasToDreOperacional(contas: GestaoContaLancamento[]): GestaoOperacionalDreLine[] {
  return contas
    .filter((c) => c.tipo === "pagar")
    .map((c) => ({
      categoria: c.categoria_operacional,
      valor: Number(c.valor),
      vencimento: c.vencimento,
      pagoEm: c.pago_em,
    }));
}

export async function loadContadorTokens(userId: string): Promise<GestaoContadorTokenRow[]> {
  const { data } = await supabase.from("gestao_contador_token" as "veiculos_estoque")
    .select("id, competencia, expires_at, created_at, last_access_at, revogado_em")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as GestaoContadorTokenRow[];
}

export async function revogarContadorToken(userId: string, tokenId: string): Promise<void> {
  const { error } = await supabase.from("gestao_contador_token" as "veiculos_estoque").update({
    revogado_em: new Date().toISOString(),
  }).eq("id", tokenId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
