export type GestaoDespesaRaioX = {
  valor: number;
  categoria: string;
};

export type GestaoVendaRaioXInput = {
  valorVenda: number | null;
  valorCompra: number | null;
  despesas: GestaoDespesaRaioX[];
};

export type GestaoVendaRaioXResult = {
  valorVenda: number;
  valorCompra: number | null;
  despesasSemComissao: number;
  comissao: number;
  lucroBruto: number | null;
  margemBrutaPct: number | null;
  lucroFinal: number | null;
  margemFinalPct: number | null;
  comissaoPctDoLucro: number | null;
  alertLevel: "none" | "amber" | "red";
  alertMessage: string | null;
  motivoProvavel: string | null;
};

const COMISSAO_CAT = "comissao";

export function isDespesaComissao(categoria: string): boolean {
  return categoria === COMISSAO_CAT;
}

export function sumDespesasSemComissao(despesas: GestaoDespesaRaioX[]): number {
  return despesas
    .filter((d) => !isDespesaComissao(d.categoria))
    .reduce((a, d) => a + d.valor, 0);
}

export function sumComissaoDespesas(despesas: GestaoDespesaRaioX[]): number {
  return despesas
    .filter((d) => isDespesaComissao(d.categoria))
    .reduce((a, d) => a + d.valor, 0);
}

export function inferMotivoProvavel(input: {
  valorVenda: number;
  valorCompra: number | null;
  despesasSemComissao: number;
  margemBrutaPct: number | null;
}): string | null {
  if (input.valorCompra == null || input.valorVenda <= 0) return null;
  const basePosCompra = input.valorVenda - input.valorCompra;
  if (basePosCompra <= 0) return "Possível compra cara ou venda abaixo do ideal.";
  const ratioDesp = input.despesasSemComissao / basePosCompra;
  const margemBaixa = input.margemBrutaPct != null && input.margemBrutaPct < 8;
  if (ratioDesp >= 0.35) return "Despesas altas de preparação.";
  if (margemBaixa) return "Possível compra cara ou venda abaixo do ideal.";
  if (ratioDesp >= 0.2 && margemBaixa) {
    return "Compra/preço apertado e preparação pesada.";
  }
  return null;
}

export function calcVendaRaioX(input: GestaoVendaRaioXInput): GestaoVendaRaioXResult | null {
  if (input.valorVenda == null || input.valorVenda <= 0) return null;
  const valorVenda = input.valorVenda;
  const despesasSemComissao = sumDespesasSemComissao(input.despesas);
  const comissao = sumComissaoDespesas(input.despesas);
  const valorCompra = input.valorCompra;

  let lucroBruto: number | null = null;
  if (valorCompra != null) {
    lucroBruto = Math.round((valorVenda - valorCompra - despesasSemComissao) * 100) / 100;
  }

  const margemBrutaPct = lucroBruto != null && valorVenda > 0
    ? (lucroBruto / valorVenda) * 100
    : null;

  const lucroFinal = lucroBruto != null
    ? Math.round((lucroBruto - comissao) * 100) / 100
    : null;

  const margemFinalPct = lucroFinal != null && valorVenda > 0
    ? (lucroFinal / valorVenda) * 100
    : null;

  const comissaoPctDoLucro = lucroBruto != null && lucroBruto > 0
    ? (comissao / lucroBruto) * 100
    : null;

  let alertLevel: GestaoVendaRaioXResult["alertLevel"] = "none";
  let alertMessage: string | null = null;

  if (lucroFinal != null && lucroFinal < 0) {
    alertLevel = "red";
    alertMessage =
      "Lucro final negativo após comissão. Possível compra cara ou venda abaixo do ideal.";
  } else if (comissaoPctDoLucro != null && comissaoPctDoLucro > 50) {
    alertLevel = "red";
    alertMessage =
      `Comissão consumiu ${comissaoPctDoLucro.toFixed(1)}% do lucro deste carro${
        margemFinalPct != null ? `: margem de só ${margemFinalPct.toFixed(1)}%` : ""
      }. Possível compra cara ou venda abaixo do ideal.`;
  } else if (comissaoPctDoLucro != null && comissaoPctDoLucro > 30) {
    alertLevel = "amber";
    alertMessage =
      `Comissão consumiu ${comissaoPctDoLucro.toFixed(1)}% do lucro deste carro. Revise compra e preço de venda.`;
  }

  const motivoProvavel = inferMotivoProvavel({
    valorVenda,
    valorCompra,
    despesasSemComissao,
    margemBrutaPct,
  });

  return {
    valorVenda,
    valorCompra,
    despesasSemComissao,
    comissao,
    lucroBruto,
    margemBrutaPct,
    lucroFinal,
    margemFinalPct,
    comissaoPctDoLucro,
    alertLevel,
    alertMessage,
    motivoProvavel,
  };
}

export type GestaoVendaRaioXRankItem = GestaoVendaRaioXResult & {
  veiculoId: string;
  label: string;
  vendedorId: string | null;
  vendedorNome: string | null;
  dataVenda: string;
};

export function rankPioresNegocios(
  items: GestaoVendaRaioXRankItem[],
  limit = 3,
): GestaoVendaRaioXRankItem[] {
  return [...items]
    .filter((i) => i.lucroFinal != null)
    .sort((a, b) => {
      const la = a.lucroFinal ?? 0;
      const lb = b.lucroFinal ?? 0;
      if (la !== lb) return la - lb;
      return (a.margemFinalPct ?? 0) - (b.margemFinalPct ?? 0);
    })
    .slice(0, limit);
}

export function formatRaioXWhatsApp(label: string, r: GestaoVendaRaioXResult): string {
  const br = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }));
  const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
  const lines = [
    `Venda ${label}:`,
    `Venda ${br(r.valorVenda)}`,
    `− Compra ${br(r.valorCompra)}`,
    `− Despesas ${br(r.despesasSemComissao)}`,
    `= Lucro bruto ${br(r.lucroBruto)} (${pct(r.margemBrutaPct)})`,
    `− Comissão ${br(r.comissao)}${
      r.comissaoPctDoLucro != null ? ` (${r.comissaoPctDoLucro.toFixed(1)}% do lucro)` : ""
    }`,
    `= Lucro final ${br(r.lucroFinal)} (${pct(r.margemFinalPct)})`,
  ];
  if (r.alertMessage) lines.push(r.alertMessage);
  return lines.join("\n");
}
