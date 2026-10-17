import { formatGestaoMoney } from "./gestao-format.ts";
import {
  buildRankingVendedores,
  filterVendasCompetencia,
  type VendaEquipeLine,
} from "./gestao-equipe-stats.ts";
import { calcMetaProgresso, competenciaFromDate, type GestaoMetaConfigJson } from "./gestao-meta-calc.ts";
import { matchGestaoVendedor, type GestaoVendedorRow } from "./gestao-vendedor-match.ts";

type Db = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => {
        gte?: (a: string, b: string) => {
          lte: (a: string, b: string) => Promise<{ data: unknown[] | null }>;
        };
        order?: (a: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null }>;
      };
    };
  };
};

export async function buildGestaoRankingReply(
  client: Db,
  userId: string,
  comissaoByVendedor: Map<string, number>,
  vendedores: GestaoVendedorRow[],
  competencia = competenciaFromDate(),
): Promise<string> {
  const [y, m] = competencia.split("-").map(Number);
  const start = `${competencia}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: vendasRaw } = await client.from("veiculo_venda").select(
    "veiculo_id, valor_venda, data_venda, vendedor_id",
  ).eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);

  const vendas: VendaEquipeLine[] = [];
  for (const v of vendasRaw ?? []) {
    const row = v as Record<string, unknown>;
    vendas.push({
      veiculo_id: String(row.veiculo_id),
      valor_venda: Number(row.valor_venda),
      data_venda: String(row.data_venda),
      vendedor_id: row.vendedor_id ? String(row.vendedor_id) : null,
      lucro_liquido: null,
    });
  }

  const nomeById = new Map(vendedores.map((v) => [v.id, v.nome]));
  const rank = buildRankingVendedores(vendas, comissaoByVendedor, nomeById, competencia);
  if (!rank.length) return `Ranking ${competencia}: nenhuma venda registrada.`;

  const lines = rank.slice(0, 8).map((r, i) =>
    `${i + 1}. ${r.nome}: ${r.qtd} carro(s), ${formatGestaoMoney(r.faturamento)}, comissão ${
      formatGestaoMoney(r.comissao)
    }`
  );
  return `Ranking vendedores (${competencia}):\n${lines.join("\n")}`;
}

export async function buildGestaoVendedorMesReply(
  client: Db,
  userId: string,
  hint: string,
  vendedores: GestaoVendedorRow[],
  competencia = competenciaFromDate(),
): Promise<string> {
  const v = matchGestaoVendedor(hint, vendedores);
  if (!v) return "Não encontrei esse vendedor. Cadastre em Gestão → Equipe.";

  const [y, m] = competencia.split("-").map(Number);
  const start = `${competencia}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data } = await client.from("veiculo_venda").select("valor_venda, data_venda")
    .eq("user_id", userId).eq("vendedor_id", v.id).gte("data_venda", start).lte("data_venda", end);

  const rows = data ?? [];
  const qtd = rows.length;
  const fat = rows.reduce((a: number, r: Record<string, unknown>) => a + Number(r.valor_venda), 0);
  return `${v.nome} em ${competencia}: ${qtd} venda(s), faturamento ${formatGestaoMoney(fat)}.`;
}

export function buildComissaoMesReply(
  comissaoByVendedor: Map<string, number>,
  vendedores: GestaoVendedorRow[],
  competencia = competenciaFromDate(),
): string {
  let total = 0;
  const lines: string[] = [];
  for (const v of vendedores) {
    const c = comissaoByVendedor.get(v.id) ?? 0;
    if (c > 0) {
      total += c;
      lines.push(`${v.nome}: ${formatGestaoMoney(c)}`);
    }
  }
  if (!lines.length) return `Comissões ${competencia}: nenhuma lançada ainda.`;
  return `Comissões ${competencia} (automáticas):\n${lines.join("\n")}\nTotal: ${formatGestaoMoney(total)}`;
}

export function buildMetaBateuReply(
  configs: Array<{ vendedor: GestaoVendedorRow; config: GestaoMetaConfigJson; realizado: number }>,
  competencia: string,
): string {
  const hit: string[] = [];
  for (const row of configs) {
    const p = calcMetaProgresso(row.config, row.realizado);
    if (p.pctAtingido >= 100) hit.push(`${row.vendedor.nome} (${p.pctAtingido.toFixed(0)}%)`);
  }
  if (!hit.length) return `Metas ${competencia}: ninguém bateu 100% ainda.`;
  return `Bateram a meta em ${competencia}:\n${hit.join("\n")}`;
}

export { filterVendasCompetencia };
