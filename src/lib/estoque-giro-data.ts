import { supabase } from "@/integrations/supabase/client";
import { loadComissaoRegra } from "@/lib/gestao-equipe-load.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { hojeSaoPaulo } from "../../supabase/functions/_shared/gestao-date-br.ts";
import {
  calcularEstoqueGiro,
  DEFAULT_ESTOQUE_GIRO_CONFIG,
  type EstoqueGiroConfig,
  type EstoqueGiroReferencia,
  type EstoqueGiroResultado,
} from "../../supabase/functions/_shared/estoque-giro-calc.ts";

export type GestaoGiroConfigRow = {
  faixa_atencao_dias: number;
  faixa_risco_dias: number;
  faixa_decisao_dias: number;
  custo_financeiro_mensal_pct: number | null;
  desvalorizacao_mensal_pct: number | null;
  repasse_desconto_fipe_pct: number | null;
  uf: string | null;
  ipva_aliquota_pct: number | null;
  ipva_loja_paga_virada: boolean;
};

export type GestaoGiroItem = {
  veiculo: GestaoVeiculoEnriched;
  resultado: EstoqueGiroResultado;
};

export function configRowToCalc(row: GestaoGiroConfigRow | null): EstoqueGiroConfig {
  if (!row) return DEFAULT_ESTOQUE_GIRO_CONFIG;
  return {
    faixaAtencaoDias: Number(row.faixa_atencao_dias),
    faixaRiscoDias: Number(row.faixa_risco_dias),
    faixaDecisaoDias: Number(row.faixa_decisao_dias),
    custoFinanceiroMensalPct: row.custo_financeiro_mensal_pct == null
      ? null
      : Number(row.custo_financeiro_mensal_pct),
    desvalorizacaoMensalPct: row.desvalorizacao_mensal_pct == null
      ? null
      : Number(row.desvalorizacao_mensal_pct),
    repasseDescontoFipePct: row.repasse_desconto_fipe_pct == null
      ? null
      : Number(row.repasse_desconto_fipe_pct),
    uf: row.uf,
    ipvaAliquotaPct: row.ipva_aliquota_pct == null ? null : Number(row.ipva_aliquota_pct),
    ipvaLojaPagaVirada: row.ipva_loja_paga_virada,
  };
}

export async function loadGestaoGiro(
  userId: string,
  veiculos: GestaoVeiculoEnriched[],
): Promise<{ config: GestaoGiroConfigRow | null; items: GestaoGiroItem[] }> {
  const [{ data: configData }, { data: refsData }, { data: trocasData }, regraComissao] =
    await Promise.all([
      supabase.from("gestao_giro_config" as "veiculos_estoque")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("veiculo_preco_referencia" as "veiculos_estoque")
        .select("veiculo_id, fonte, valor, capturado_em")
        .eq("user_id", userId)
        .order("capturado_em", { ascending: false }),
      supabase.from("gestao_troca" as "veiculos_estoque")
        .select("veiculo_id, fipe_valor, updated_at")
        .eq("user_id", userId)
        .not("veiculo_id", "is", null)
        .not("fipe_valor", "is", null),
      loadComissaoRegra(userId, null),
    ]);

  const byVehicle = new Map<string, EstoqueGiroReferencia[]>();
  for (const raw of refsData ?? []) {
    const row = raw as {
      veiculo_id: string;
      fonte: EstoqueGiroReferencia["fonte"];
      valor: number;
      capturado_em: string;
    };
    const list = byVehicle.get(row.veiculo_id) ?? [];
    list.push({
      fonte: row.fonte,
      valor: Number(row.valor),
      capturadoEm: row.capturado_em,
    });
    byVehicle.set(row.veiculo_id, list);
  }
  // Reaproveita FIPE já registrada na avaliação/troca, sem duplicar nem inventar valor.
  for (const raw of trocasData ?? []) {
    const row = raw as {
      veiculo_id: string | null;
      fipe_valor: number | null;
      updated_at: string;
    };
    if (!row.veiculo_id || row.fipe_valor == null) continue;
    const list = byVehicle.get(row.veiculo_id) ?? [];
    if (!list.some((r) => r.fonte === "fipe")) {
      list.push({
        fonte: "fipe",
        valor: Number(row.fipe_valor),
        capturadoEm: row.updated_at,
      });
      byVehicle.set(row.veiculo_id, list);
    }
  }

  const config = (configData ?? null) as unknown as GestaoGiroConfigRow | null;
  const calcConfig = configRowToCalc(config);
  const items = veiculos
    .filter((v) => v.status === "disponivel" || v.status === "reservado")
    .map((veiculo) => ({
      veiculo,
      resultado: calcularEstoqueGiro({
        hoje: hojeSaoPaulo(),
        dataCompra: veiculo.dataCompra,
        createdAt: veiculo.created_at,
        valorCompra: veiculo.valorCompra,
        despesas: veiculo.despesas.map((d) => Number(d.valor)),
        precoAnunciado: veiculo.preco,
        referencias: byVehicle.get(veiculo.id) ?? [],
        config: calcConfig,
        regraComissao,
        leadsUltimos30Dias: null,
      }),
    }))
    .sort((a, b) => b.resultado.indiceRisco - a.resultado.indiceRisco);

  return { config, items };
}

export async function saveGestaoGiroConfig(
  userId: string,
  config: GestaoGiroConfigRow,
): Promise<void> {
  const { error } = await supabase.from("gestao_giro_config" as "veiculos_estoque")
    .upsert({ user_id: userId, ...config }, { onConflict: "user_id" });
  if (error) throw error;
}

export type GiroFipeRefreshResult = {
  success: boolean;
  gravados?: number;
  nao_encontrados?: number;
  processados?: number;
  pendentes_restantes?: number;
  resultados?: Array<{
    veiculo_id: string;
    status: "gravado" | "nao_encontrada";
    motivo?: string;
  }>;
  error?: string;
};

export type GiroFipeRefreshCompleto = {
  gravados: number;
  semFipe: Array<{ veiculo_id: string; motivo: string }>;
  rodadas: number;
};

export async function refreshGestaoGiroFipe(
  limit = 20,
  skipIds: string[] = [],
): Promise<GiroFipeRefreshResult> {
  const { data, error } = await supabase.functions.invoke("giro-fipe-refresh", {
    body: { limit, skip_ids: skipIds },
  });
  if (error) throw error;
  return data as GiroFipeRefreshResult;
}

export async function refreshGestaoGiroFipeCompleto(
  onProgress?: (info: { rodada: number; processados: number }) => void,
): Promise<GiroFipeRefreshCompleto> {
  const skipIds: string[] = [];
  const semFipeMap = new Map<string, string>();
  let gravados = 0;
  let rodadas = 0;

  while (true) {
    rodadas += 1;
    const r = await refreshGestaoGiroFipe(20, skipIds);
    if (!r.success) throw new Error(r.error ?? "Falha ao atualizar FIPE");
    gravados += r.gravados ?? 0;
    for (const item of r.resultados ?? []) {
      if (item.status === "nao_encontrada") {
        if (!skipIds.includes(item.veiculo_id)) skipIds.push(item.veiculo_id);
        semFipeMap.set(item.veiculo_id, item.motivo ?? "FIPE não encontrada");
      }
    }
    onProgress?.({ rodada: rodadas, processados: r.processados ?? 0 });
    if ((r.processados ?? 0) === 0) break;
  }

  return {
    gravados,
    semFipe: [...semFipeMap.entries()].map(([veiculo_id, motivo]) => ({
      veiculo_id,
      motivo,
    })),
    rodadas,
  };
}

export async function saveGestaoGiroReferenciaManual(
  userId: string,
  veiculoId: string,
  valor: number,
): Promise<void> {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Informe um valor de repasse maior que zero.");
  }
  const { error } = await supabase.from("veiculo_preco_referencia" as "veiculos_estoque")
    .insert({
      user_id: userId,
      veiculo_id: veiculoId,
      fonte: "manual",
      valor: Math.round(valor * 100) / 100,
    });
  if (error) throw error;
}
