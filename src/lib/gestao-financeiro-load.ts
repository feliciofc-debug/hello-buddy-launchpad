import { supabase } from "@/integrations/supabase/client";
import { planBonusOperacionalUpserts } from "../../supabase/functions/_shared/gestao-bonus-operacional-sync.ts";
import type { GestaoContaFluxo } from "../../supabase/functions/_shared/gestao-fluxo-calc.ts";
import type { GestaoOperacionalDreLine, GestaoVendaDreLine } from "../../supabase/functions/_shared/gestao-dre-calc.ts";
import type { GestaoVeiculoEnriched } from "./gestao-lucro-types.ts";

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

export async function loadGestaoContas(userId: string): Promise<GestaoContaLancamento[]> {
  await syncBonusOperacionalContas(userId);
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
    recorrencia_dia_mes: c.recorrencia_dia_mes,
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

export async function createContadorToken(
  userId: string,
  competencia: string,
): Promise<{ token: string; expiresAt: string }> {
  const { generateGestaoContadorToken, hashGestaoContadorToken, GESTAO_CONTADOR_TOKEN_TTL_DAYS } =
    await import("../../supabase/functions/_shared/gestao-contador-token.ts");
  const token = generateGestaoContadorToken();
  const token_hash = await hashGestaoContadorToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + GESTAO_CONTADOR_TOKEN_TTL_DAYS);
  const { error } = await supabase.from("gestao_contador_token" as "veiculos_estoque").insert({
    user_id: userId,
    token_hash,
    competencia,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt: expiresAt.toISOString() };
}
