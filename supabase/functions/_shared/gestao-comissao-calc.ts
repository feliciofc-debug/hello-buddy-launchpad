export type GestaoFaixaMargem = {
  margemMinInclusive: number;
  margemMaxExclusive: number | null;
  pctSobreLucro: number;
};

export type GestaoComissaoRegraJson = {
  pctSobreVenda: number | null;
  pctSobreLucro: number | null;
  fixoPorCarro: number | null;
  /** Quando true, % lucro fixo é ignorado e valem só as faixas (se houver). */
  usarFaixasMargem: boolean;
  faixasMargem: GestaoFaixaMargem[];
  gerentePctSobreComissaoEquipe: number | null;
  gerentePctSobreVenda: number | null;
};

export type ComissaoRegraModo = "pct_venda" | "pct_lucro" | "fixo" | "faixas";

export const DEFAULT_COMISSAO_REGRA: GestaoComissaoRegraJson = {
  pctSobreVenda: 1,
  pctSobreLucro: null,
  fixoPorCarro: null,
  usarFaixasMargem: false,
  faixasMargem: [
    { margemMinInclusive: 0, margemMaxExclusive: 5, pctSobreLucro: 0.5 },
    { margemMinInclusive: 5, margemMaxExclusive: 10, pctSobreLucro: 1 },
    { margemMinInclusive: 10, margemMaxExclusive: null, pctSobreLucro: 1.5 },
  ],
  gerentePctSobreComissaoEquipe: null,
  gerentePctSobreVenda: null,
};

export type GestaoComissaoCalcInput = {
  valorVenda: number;
  lucroLiquido: number | null;
  margemPct: number | null;
  regra: GestaoComissaoRegraJson;
};

export type GestaoComissaoCalcResult = {
  total: number;
  pctLucroAplicado: number | null;
  breakdown: string[];
};

export function resolvePctLucroPorMargem(
  margemPct: number | null,
  regra: GestaoComissaoRegraJson,
): number | null {
  if (regra.usarFaixasMargem && regra.faixasMargem?.length && margemPct != null) {
    for (const faixa of regra.faixasMargem) {
      const min = faixa.margemMinInclusive;
      const max = faixa.margemMaxExclusive;
      if (margemPct >= min && (max == null || margemPct < max)) {
        return faixa.pctSobreLucro;
      }
    }
    return null;
  }
  return regra.pctSobreLucro;
}

export function calcGestaoComissao(input: GestaoComissaoCalcInput): GestaoComissaoCalcResult {
  const { valorVenda, lucroLiquido, margemPct, regra } = input;
  const breakdown: string[] = [];
  let total = 0;

  if (regra.fixoPorCarro != null && regra.fixoPorCarro > 0) {
    total += regra.fixoPorCarro;
    breakdown.push(`Fixo ${regra.fixoPorCarro}`);
  }

  if (regra.pctSobreVenda != null && regra.pctSobreVenda > 0) {
    const part = (valorVenda * regra.pctSobreVenda) / 100;
    total += part;
    breakdown.push(`${regra.pctSobreVenda}% venda`);
  }

  const pctLucro = resolvePctLucroPorMargem(margemPct, regra);
  if (pctLucro != null && pctLucro > 0 && lucroLiquido != null && lucroLiquido > 0) {
    const part = (lucroLiquido * pctLucro) / 100;
    total += part;
    breakdown.push(`${pctLucro}% lucro`);
  }

  return {
    total: Math.round(total * 100) / 100,
    pctLucroAplicado: pctLucro,
    breakdown,
  };
}

export function calcComissaoGerente(
  comissaoEquipeTotal: number,
  valorVenda: number,
  regraGerente: GestaoComissaoRegraJson,
): number {
  const pctVenda = regraGerente.gerentePctSobreVenda;
  if (pctVenda != null && pctVenda > 0 && valorVenda > 0) {
    return Math.round((valorVenda * pctVenda) / 100 * 100) / 100;
  }
  const pct = regraGerente.gerentePctSobreComissaoEquipe;
  if (pct == null || pct <= 0 || comissaoEquipeTotal <= 0) return 0;
  return Math.round((comissaoEquipeTotal * pct) / 100 * 100) / 100;
}

/** Normaliza JSON legado sem campos novos. */
export function normalizeComissaoRegra(raw: Partial<GestaoComissaoRegraJson>): GestaoComissaoRegraJson {
  return {
    ...DEFAULT_COMISSAO_REGRA,
    ...raw,
    faixasMargem: raw.faixasMargem?.length
      ? raw.faixasMargem
      : DEFAULT_COMISSAO_REGRA.faixasMargem,
    usarFaixasMargem: raw.usarFaixasMargem ?? false,
    gerentePctSobreVenda: raw.gerentePctSobreVenda ?? null,
  };
}

export function detectComissaoRegraModo(regra: GestaoComissaoRegraJson): ComissaoRegraModo {
  const r = normalizeComissaoRegra(regra);
  if (r.usarFaixasMargem && r.faixasMargem.length > 0) return "faixas";
  if (r.fixoPorCarro != null && r.fixoPorCarro > 0) return "fixo";
  if (r.pctSobreVenda != null && r.pctSobreVenda > 0) return "pct_venda";
  if (r.pctSobreLucro != null && r.pctSobreLucro > 0) return "pct_lucro";
  return "pct_venda";
}

export function applyComissaoRegraModo(
  regra: GestaoComissaoRegraJson,
  modo: ComissaoRegraModo,
): GestaoComissaoRegraJson {
  const base = normalizeComissaoRegra(regra);
  if (modo === "pct_venda") {
    return {
      ...base,
      pctSobreVenda: base.pctSobreVenda ?? 1,
      pctSobreLucro: null,
      fixoPorCarro: null,
      usarFaixasMargem: false,
    };
  }
  if (modo === "pct_lucro") {
    return {
      ...base,
      pctSobreVenda: null,
      pctSobreLucro: base.pctSobreLucro ?? 1,
      fixoPorCarro: null,
      usarFaixasMargem: false,
    };
  }
  if (modo === "fixo") {
    return {
      ...base,
      pctSobreVenda: null,
      pctSobreLucro: null,
      fixoPorCarro: base.fixoPorCarro ?? 1000,
      usarFaixasMargem: false,
    };
  }
  return {
    ...base,
    pctSobreVenda: null,
    pctSobreLucro: null,
    fixoPorCarro: null,
    usarFaixasMargem: true,
  };
}
