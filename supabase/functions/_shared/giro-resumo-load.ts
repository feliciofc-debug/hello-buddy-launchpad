import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  DEFAULT_COMISSAO_REGRA,
  normalizeComissaoRegra,
  type GestaoComissaoRegraJson,
} from "./gestao-comissao-calc.ts";
import {
  calcularEstoqueGiro,
  DEFAULT_ESTOQUE_GIRO_CONFIG,
  type EstoqueGiroConfig,
  type EstoqueGiroReferencia,
} from "./estoque-giro-calc.ts";
import { hojeSaoPaulo } from "./gestao-date-br.ts";
import type { GiroResumoVeiculoLinha } from "./giro-resumo-mensagem.ts";

export type GestaoGiroConfigDbRow = {
  faixa_atencao_dias: number;
  faixa_risco_dias: number;
  faixa_decisao_dias: number;
  custo_financeiro_mensal_pct: number | null;
  desvalorizacao_mensal_pct: number | null;
  repasse_desconto_fipe_pct: number | null;
  uf: string | null;
  ipva_aliquota_pct: number | null;
  ipva_loja_paga_virada: boolean;
  resumo_diario_ativo?: boolean;
  resumo_diario_hora?: string;
  resumo_ultimo_envio?: string | null;
  fipe_auto_ultima_competencia?: string | null;
};

function configRowToCalc(row: GestaoGiroConfigDbRow | null): EstoqueGiroConfig {
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

async function loadComissaoRegra(
  sb: SupabaseClient,
  userId: string,
): Promise<GestaoComissaoRegraJson> {
  const { data } = await sb.from("gestao_comissao_regra")
    .select("regra_json")
    .eq("user_id", userId)
    .is("vendedor_id", null)
    .maybeSingle();
  const row = data as { regra_json?: GestaoComissaoRegraJson } | null;
  return normalizeComissaoRegra(row?.regra_json ?? DEFAULT_COMISSAO_REGRA);
}

function vehicleShortLabel(v: {
  marca: string;
  modelo: string;
  versao?: string | null;
}): string {
  return [v.marca, v.modelo].filter(Boolean).join(" ");
}

export async function loadGiroResumoItens(
  sb: SupabaseClient,
  userId: string,
  hojeYmd = hojeSaoPaulo(),
): Promise<{ config: GestaoGiroConfigDbRow | null; items: GiroResumoVeiculoLinha[] }> {
  const [
    { data: configData },
    { data: veiculos },
    { data: compras },
    { data: despesas },
    { data: refsData },
    { data: trocasData },
    regraComissao,
  ] = await Promise.all([
    sb.from("gestao_giro_config").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("veiculos_estoque")
      .select("id, marca, modelo, versao, preco, status, created_at")
      .eq("user_id", userId)
      .in("status", ["disponivel", "reservado"]),
    sb.from("veiculo_compra").select("veiculo_id, valor_compra, data_compra").eq("user_id", userId),
    sb.from("veiculo_despesas").select("veiculo_id, valor").eq("user_id", userId).is("deleted_at", null),
    sb.from("veiculo_preco_referencia")
      .select("veiculo_id, fonte, valor, capturado_em")
      .eq("user_id", userId)
      .order("capturado_em", { ascending: false }),
    sb.from("gestao_troca")
      .select("veiculo_id, fipe_valor, updated_at")
      .eq("user_id", userId)
      .not("veiculo_id", "is", null)
      .not("fipe_valor", "is", null),
    loadComissaoRegra(sb, userId),
  ]);

  const compraBy = new Map(
    (compras ?? []).map((c: { veiculo_id: string; valor_compra: number; data_compra: string }) => [
      c.veiculo_id,
      c,
    ]),
  );
  const despesasBy = new Map<string, number[]>();
  for (const d of despesas ?? []) {
    const row = d as { veiculo_id: string; valor: number };
    const list = despesasBy.get(row.veiculo_id) ?? [];
    list.push(Number(row.valor));
    despesasBy.set(row.veiculo_id, list);
  }

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

  const config = (configData ?? null) as GestaoGiroConfigDbRow | null;
  const calcConfig = configRowToCalc(config);

  const items: GiroResumoVeiculoLinha[] = (veiculos ?? []).map((raw) => {
    const v = raw as {
      id: string;
      marca: string;
      modelo: string;
      versao: string | null;
      preco: number | null;
      created_at: string;
    };
    const compra = compraBy.get(v.id);
    const valorCompra = compra ? Number(compra.valor_compra) : null;
    const resultado = calcularEstoqueGiro({
      hoje: hojeYmd,
      dataCompra: compra?.data_compra ?? null,
      createdAt: v.created_at,
      valorCompra,
      despesas: despesasBy.get(v.id) ?? [],
      precoAnunciado: v.preco == null ? null : Number(v.preco),
      referencias: byVehicle.get(v.id) ?? [],
      config: calcConfig,
      regraComissao,
      leadsUltimos30Dias: null,
    });
    let custoFinanceiroDiario: number | null = null;
    if (
      valorCompra != null &&
      valorCompra > 0 &&
      calcConfig.custoFinanceiroMensalPct != null
    ) {
      custoFinanceiroDiario = Math.round(
        valorCompra * calcConfig.custoFinanceiroMensalPct / 100 / 30 * 100,
      ) / 100;
    }
    return {
      label: vehicleShortLabel(v),
      dias: resultado.diasEmEstoque,
      faixa: resultado.faixa,
      resultado,
      custoFinanceiroDiario,
    };
  });

  return { config, items };
}
