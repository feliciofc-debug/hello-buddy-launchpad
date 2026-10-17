import { competenciaFromDate } from "./gestao-meta-calc.ts";

export type VendaEquipeLine = {
  veiculo_id: string;
  valor_venda: number;
  data_venda: string;
  vendedor_id: string | null;
  lucro_liquido: number | null;
};

export type RankingVendedor = {
  vendedor_id: string | null;
  nome: string;
  qtd: number;
  faturamento: number;
  lucroGerado: number;
  comissao: number;
};

export function filterVendasCompetencia(
  vendas: VendaEquipeLine[],
  competencia: string,
): VendaEquipeLine[] {
  const [y, m] = competencia.split("-").map(Number);
  const start = `${competencia}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  return vendas.filter((v) => v.data_venda >= start && v.data_venda <= end);
}

export function buildRankingVendedores(
  vendas: VendaEquipeLine[],
  comissaoByVendedor: Map<string, number>,
  nomeById: Map<string, string>,
  competencia = competenciaFromDate(),
): RankingVendedor[] {
  const month = filterVendasCompetencia(vendas, competencia);
  const map = new Map<string | null, RankingVendedor>();

  for (const v of month) {
    const key = v.vendedor_id;
    const cur = map.get(key) ?? {
      vendedor_id: key,
      nome: key ? (nomeById.get(key) ?? "Vendedor") : "Sem vendedor",
      qtd: 0,
      faturamento: 0,
      lucroGerado: 0,
      comissao: 0,
    };
    cur.qtd += 1;
    cur.faturamento += v.valor_venda;
    cur.lucroGerado += v.lucro_liquido ?? 0;
    map.set(key, cur);
  }

  for (const [vid, val] of comissaoByVendedor) {
    const cur = map.get(vid);
    if (cur) cur.comissao = val;
  }

  return [...map.values()].sort((a, b) => b.faturamento - a.faturamento);
}
