import type { GestaoLucroAlertKind, GestaoVeiculoEnriched } from "./gestao-lucro-types.ts";
import { isActiveStock, vehicleDays } from "./gestao-lucro-data.ts";

export type GestaoLucroAlert = {
  kind: GestaoLucroAlertKind;
  count: number;
  veiculoIds: string[];
};

export function buildGestaoLucroAlerts(veiculos: GestaoVeiculoEnriched[]): GestaoLucroAlert[] {
  const stock = veiculos.filter(isActiveStock);

  const semCusto = stock.filter((v) => v.lucro.custoCompraPendente);
  const parado60 = stock.filter((v) => !v.lucro.custoCompraPendente && vehicleDays(v) > 60);
  const margemBaixa = stock.filter((v) => {
    if (v.lucro.custoCompraPendente) return false;
    const lucro = v.lucro.lucroProjetado;
    if (lucro != null && lucro < 0) return true;
    const m = lucro != null && v.preco
      ? (lucro / v.preco) * 100
      : null;
    return m != null && m < 5;
  });

  const lucroNegComissao = veiculos.filter((v) => {
    if (v.lucro.lucroLiquido == null || v.lucro.lucroLiquido >= 0) return false;
    if (!v.lucro.vendido && v.status !== "vendido" && v.valorVenda == null) return false;
    return v.despesas.some((d) => d.categoria === "comissao");
  });

  return [
    {
      kind: "lucro_negativo_comissao",
      count: lucroNegComissao.length,
      veiculoIds: lucroNegComissao.map((v) => v.id),
    },
    {
      kind: "sem_custo_compra",
      count: semCusto.length,
      veiculoIds: semCusto.map((v) => v.id),
    },
    {
      kind: "parado_60",
      count: parado60.length,
      veiculoIds: parado60.map((v) => v.id),
    },
    {
      kind: "margem_baixa",
      count: margemBaixa.length,
      veiculoIds: margemBaixa.map((v) => v.id),
    },
  ].filter((a) => a.count > 0);
}

export function alertLabel(kind: GestaoLucroAlertKind): string {
  switch (kind) {
    case "lucro_negativo_comissao":
      return "Lucro negativo (comissão)";
    case "sem_custo_compra":
      return "Sem custo de compra";
    case "parado_60":
      return "Parados há mais de 60 dias";
    case "margem_baixa":
      return "Margem abaixo de 5% ou negativa";
  }
}
