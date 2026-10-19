import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";

export type GestaoTrocaConfigCalc = {
  margem_alvo_pct: number;
  km_ref_mes_padrao: number;
  bonus_km_baixo_pct: number;
  desconto_km_alto_pct_por_faixa: number;
  desconto_km_alto_teto_pct: number;
  fator_troca_sobre_fipe: number;
  fator_loja_sobre_fipe: number;
  custo_dia_estoque: number;
  dias_giro_padrao: number;
  desconto_leilao_pct: number;
};

export const DEFAULT_GESTAO_TROCA_CONFIG: GestaoTrocaConfigCalc = {
  margem_alvo_pct: 10,
  km_ref_mes_padrao: 1000,
  bonus_km_baixo_pct: 2,
  desconto_km_alto_pct_por_faixa: 1,
  desconto_km_alto_teto_pct: 6,
  fator_troca_sobre_fipe: 0.85,
  fator_loja_sobre_fipe: 1,
  custo_dia_estoque: 0,
  dias_giro_padrao: 45,
  desconto_leilao_pct: 25,
};

export type TrocaHistoricoGrupo = {
  qtd_vendidos_12m: number;
  media_dias_giro: number | null;
  media_compra: number | null;
  margem_media_pct: number | null;
};

export type CalcTrocaPrecoInput = {
  km: number | null;
  ano_modelo: number | null;
  kbb_troca: number | null;
  kbb_loja: number | null;
  kbb_km_caracteristico: number | null;
  fipe_valor: number | null;
  preparacao_estimada: number;
  valor_proposto: number | null;
};

export type CalcTrocaPrecoResult = {
  km_mes: number | null;
  km_ref_mes: number;
  ajuste_km_pct: number;
  base_troca: number | null;
  venda_esperada: number | null;
  ajustado: number | null;
  dias_giro: number;
  teto: number | null;
  valor_sugerido: number | null;
  faixa_verde_min: number | null;
  faixa_verde_max: number | null;
  semaforo: "verde" | "amarelo" | "vermelho" | null;
  bloqueio: boolean;
  justificativas: string[];
  historico_exibicao: TrocaHistoricoGrupo;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mesesEntreJanAnoModeloEHoje(
  anoModelo: number | null,
  hoje = new Date(),
): number {
  if (!anoModelo || !Number.isFinite(anoModelo)) return 12;
  const months = (hoje.getFullYear() - anoModelo) * 12 + (hoje.getMonth() + 1);
  return Math.max(1, months);
}

export function calcAjusteKmPct(
  ratio: number,
  config: GestaoTrocaConfigCalc,
): number {
  if (ratio <= 0.8) return config.bonus_km_baixo_pct / 100;
  if (ratio <= 1.2) return 0;
  const excess = ratio - 1.2;
  const steps = Math.ceil(excess / 0.25);
  const descontoPct = Math.min(
    config.desconto_km_alto_teto_pct,
    steps * config.desconto_km_alto_pct_por_faixa,
  );
  return -descontoPct / 100;
}

function formatPctSigned(pct: number): string {
  const v = Math.abs(pct * 100);
  const s = v.toFixed(0).replace(".", ",");
  return pct >= 0 ? `+${s}%` : `−${s}%`;
}

function formatMoneyBr(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function semaforoFromProposto(
  proposto: number | null,
  faixaMax: number | null,
  teto: number | null,
): "verde" | "amarelo" | "vermelho" | null {
  if (proposto == null || faixaMax == null || teto == null) return null;
  if (proposto <= faixaMax) return "verde";
  if (proposto <= teto) return "amarelo";
  return "vermelho";
}

export function calcTrocaPreco(
  input: CalcTrocaPrecoInput,
  config: GestaoTrocaConfigCalc = DEFAULT_GESTAO_TROCA_CONFIG,
  historico: TrocaHistoricoGrupo = {
    qtd_vendidos_12m: 0,
    media_dias_giro: null,
    media_compra: null,
    margem_media_pct: null,
  },
  procedencia?: ProcedenciaResumoJson | null,
  hoje = new Date(),
): CalcTrocaPrecoResult {
  const justificativas: string[] = [];
  let bloqueio = false;

  const meses = mesesEntreJanAnoModeloEHoje(input.ano_modelo, hoje);
  const km = input.km != null && Number.isFinite(input.km) ? input.km : null;
  const km_mes = km != null ? km / meses : null;

  let km_ref_mes = config.km_ref_mes_padrao;
  if (input.kbb_km_caracteristico != null && input.kbb_km_caracteristico > 0) {
    km_ref_mes = input.kbb_km_caracteristico / meses;
  }

  let ajuste_km_pct = 0;
  if (km_mes != null && km_ref_mes > 0) {
    const ratio = km_mes / km_ref_mes;
    ajuste_km_pct = calcAjusteKmPct(ratio, config);
    if (ajuste_km_pct > 0) {
      justificativas.push(
        `${formatPctSigned(ajuste_km_pct)} km baixo (${Math.round(km_mes)} km/mês)`,
      );
    } else if (ajuste_km_pct < 0) {
      justificativas.push(
        `${formatPctSigned(ajuste_km_pct)} km alto (${Math.round(km_mes)} km/mês)`,
      );
    }
  }

  const fipe = input.fipe_valor != null && input.fipe_valor > 0 ? input.fipe_valor : null;
  const base_troca = input.kbb_troca != null && input.kbb_troca > 0
    ? input.kbb_troca
    : fipe != null
    ? fipe * config.fator_troca_sobre_fipe
    : null;
  const venda_esperada = input.kbb_loja != null && input.kbb_loja > 0
    ? input.kbb_loja
    : fipe != null
    ? fipe * config.fator_loja_sobre_fipe
    : null;

  if (base_troca == null && fipe == null) {
    justificativas.push("Informe KBB ou FIPE para calcular.");
  } else if (input.kbb_troca == null && fipe != null) {
    justificativas.push(
      `Base troca: FIPE × ${config.fator_troca_sobre_fipe} (${formatMoneyBr(base_troca ?? 0)})`,
    );
  }

  const prep = Math.max(0, input.preparacao_estimada ?? 0);
  if (prep > 0) {
    justificativas.push(`−${formatMoneyBr(prep)} preparação`);
  }

  let ajustado = base_troca != null
    ? round2(base_troca * (1 + ajuste_km_pct) - prep)
    : null;

  const dias_giro = historico.media_dias_giro != null && historico.qtd_vendidos_12m > 0
    ? Math.round(historico.media_dias_giro)
    : config.dias_giro_padrao;

  if (historico.qtd_vendidos_12m > 0 && historico.media_dias_giro != null) {
    justificativas.push(
      `Giro médio ${dias_giro} dias (${historico.qtd_vendidos_12m} carros iguais)`,
    );
  } else {
    justificativas.push(`Giro padrão ${dias_giro} dias (sem histórico)`);
  }

  let teto = venda_esperada != null
    ? round2(
      venda_esperada * (1 - config.margem_alvo_pct / 100) - prep -
        config.custo_dia_estoque * dias_giro,
    )
    : null;

  let valor_sugerido = ajustado != null && teto != null
    ? round2(Math.min(ajustado, teto))
    : ajustado ?? teto;

  if (ajustado != null && teto != null && teto < ajustado) {
    justificativas.push("Teto limitou o valor sugerido");
  }

  let faixa_verde_min = valor_sugerido != null ? round2(valor_sugerido * 0.98) : null;
  let faixa_verde_max = valor_sugerido;

  if (procedencia) {
    if (procedencia.leilao?.possui || procedencia.perda_total?.possui) {
      justificativas.push(
        procedencia.leilao?.classificacao
          ? `⚠️ leilão classificação ${procedencia.leilao.classificacao}`
          : "⚠️ perda total consta",
      );
      if (valor_sugerido != null) {
        valor_sugerido = round2(
          valor_sugerido * (1 - config.desconto_leilao_pct / 100),
        );
        faixa_verde_min = round2(valor_sugerido * 0.98);
        faixa_verde_max = valor_sugerido;
        justificativas.push("Não recomendado — desconto por leilão/sinistro");
      }
    }
    if (procedencia.roubo_furto?.possui || procedencia.renajud?.possui) {
      bloqueio = true;
      justificativas.push("🔴 bloqueio: roubo/furto ou Renajud");
    }
    if (procedencia.gravame?.possui) {
      justificativas.push("⚠️ gravame — quitar financiamento antes");
    }
  }

  let semaforo = semaforoFromProposto(
    input.valor_proposto,
    faixa_verde_max,
    teto,
  );
  if (bloqueio) semaforo = "vermelho";
  if (
    procedencia &&
    (procedencia.leilao?.possui || procedencia.perda_total?.possui)
  ) {
    semaforo = "vermelho";
  }

  return {
    km_mes: km_mes != null ? round2(km_mes) : null,
    km_ref_mes: round2(km_ref_mes),
    ajuste_km_pct,
    base_troca: base_troca != null ? round2(base_troca) : null,
    venda_esperada: venda_esperada != null ? round2(venda_esperada) : null,
    ajustado,
    dias_giro,
    teto,
    valor_sugerido,
    faixa_verde_min,
    faixa_verde_max,
    semaforo,
    bloqueio,
    justificativas,
    historico_exibicao: historico,
  };
}
