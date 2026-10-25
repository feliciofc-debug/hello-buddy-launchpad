import { buildGestaoContadorPacote } from "./gestao-contador-pacote-build.ts";
import { intervaloCompetencia } from "./gestao-date-br.ts";
import type { GestaoOperacionalDreLine, GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { isContaDespesaOperacional } from "./gestao-conta-natureza.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export function contasToDreOperacionalRows(
  contas: Array<{ tipo: string; natureza?: string | null; categoria_operacional: string; valor: number; vencimento: string; pago_em: string | null }>,
): GestaoOperacionalDreLine[] {
  return contas
    .filter(isContaDespesaOperacional)
    .map((c) => ({
      categoria: c.categoria_operacional,
      valor: Number(c.valor),
      vencimento: c.vencimento,
      pagoEm: c.pago_em,
    }));
}

export async function loadGestaoContadorPacoteData(
  client: Db,
  userId: string,
  competencia: string,
) {
  const { start, end } = intervaloCompetencia(competencia);

  const [{ data: empresa }, { data: vendas }, { data: contas }, { data: nfes }] = await Promise.all([
    client.from("empresa_config").select("nome_empresa").eq("user_id", userId).maybeSingle(),
    client.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
      .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end),
    client.from("gestao_conta_lancamento").select("*")
      .eq("user_id", userId).is("deleted_at", null),
    client.from("gestao_nfe").select(
      "id, tipo_operacao, status, numero, serie, valor_total, authorized_at, created_at, xml_url, danfe_url",
    ).eq("user_id", userId),
  ]);

  const vendasLines: GestaoVendaDreLine[] = [];
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      client.from("veiculo_compra").select("valor_compra").eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      client.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    vendasLines.push({
      veiculoId: vid,
      dataVenda: String(v.data_venda),
      valorVenda: Number(v.valor_venda),
      valorCompra: compra ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
        valor: Number(d.valor),
        categoria: d.categoria,
      })),
    });
  }

  const contasList = (contas ?? []) as Array<{
    tipo: string;
    categoria_operacional: string;
    valor: number;
    vencimento: string;
    pago_em: string | null;
    recebido_em: string | null;
    observacao: string | null;
    origem: string;
    natureza: string;
  }>;

  return buildGestaoContadorPacote({
    competencia,
    nomeEmpresa: empresa?.nome_empresa ? String(empresa.nome_empresa) : "Loja",
    vendas: vendasLines,
    operacionais: contasToDreOperacionalRows(contasList),
    contas: contasList
      .filter((c) => c.vencimento.startsWith(competencia))
      .map((c) => ({
        tipo: c.tipo,
        categoria: c.categoria_operacional,
        categoriaLabel: c.categoria_operacional,
        valor: Number(c.valor),
        vencimento: c.vencimento,
        liquidadoEm: c.tipo === "pagar" ? c.pago_em : c.recebido_em,
        observacao: c.observacao,
      })),
    comissoesBonus: contasList
      .filter((c) => c.origem === "bonus_g2" && c.vencimento.startsWith(competencia))
      .map((c) => ({ descricao: c.observacao ?? "Bônus", valor: Number(c.valor) })),
    notasFiscais: (nfes ?? []).map((n: Record<string, unknown>) => ({
      id: String(n.id),
      tipo_operacao: String(n.tipo_operacao),
      status: String(n.status),
      numero: n.numero != null ? Number(n.numero) : null,
      serie: n.serie != null ? Number(n.serie) : null,
      valor_total: n.valor_total != null ? Number(n.valor_total) : null,
      authorized_at: n.authorized_at ? String(n.authorized_at) : null,
      created_at: String(n.created_at),
      xml_url: n.xml_url ? String(n.xml_url) : null,
      danfe_url: n.danfe_url ? String(n.danfe_url) : null,
    })),
  });
}
