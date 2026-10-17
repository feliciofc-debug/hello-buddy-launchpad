import { classifyGestaoIntent, type GestaoIntentKind } from "./gestao-intent-pt.ts";
import { competenciaFromDate } from "./gestao-meta-calc.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { calcDreMes, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import {
  buildAReceberReply,
  buildContasSemanaReply,
  buildContasVencemAmanhaReply,
  buildLucroLojaMesReply,
  type GestaoContaInbound,
} from "./gestao-financeiro-inbound.ts";
import { buildConciliacaoPendenteReply } from "./gestao-conciliacao-inbound.ts";
import { buildContratosPendentesReply } from "./gestao-contrato-inbound.ts";
import { buildNotasMesReply } from "./gestao-nfe-inbound.ts";
import {
  buildComissaoMesReply,
  buildGestaoRankingReply,
} from "./gestao-equipe-inbound.ts";
import { formatGestaoVeiculoLabel } from "./gestao-veiculo-match.ts";

export type GestaoAssistenteQueryResult = {
  queryKind: string;
  reply: string;
  facts: Record<string, string | number | boolean>;
};

type Db = { from: (t: string) => Record<string, unknown> };

const MUTATING: Set<GestaoIntentKind> = new Set([
  "despesa",
  "compra",
  "venda",
  "desfazer",
  "nfe_emit",
  "pacote_contador",
  "revogar_link_contador",
]);

export function isGestaoAssistenteMutatingIntent(kind: GestaoIntentKind): boolean {
  return MUTATING.has(kind);
}

async function loadContas(sb: Db, userId: string): Promise<GestaoContaInbound[]> {
  const { data } = await sb.from("gestao_conta_lancamento").select(
    "tipo, categoria_operacional, valor, vencimento, pago_em, recebido_em, observacao",
  ).eq("user_id", userId).is("deleted_at", null);
  return (data ?? []).map((c: Record<string, unknown>) => ({
    tipo: c.tipo as "pagar" | "receber",
    categoria: String(c.categoria_operacional ?? ""),
    valor: Number(c.valor),
    vencimento: String(c.vencimento ?? ""),
    pago_em: c.pago_em ? String(c.pago_em) : null,
    recebido_em: c.recebido_em ? String(c.recebido_em) : null,
    observacao: c.observacao ? String(c.observacao) : null,
  }));
}

async function loadVendasDreMes(sb: Db, userId: string, competencia: string): Promise<GestaoVendaDreLine[]> {
  const start = `${competencia}-01`;
  const [y, m] = competencia.split("-").map(Number);
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const lines: GestaoVendaDreLine[] = [];
  for (const v of vendas ?? []) {
    const vid = String((v as Record<string, unknown>).veiculo_id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra").eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    lines.push({
      veiculoId: vid,
      dataVenda: String((v as Record<string, unknown>).data_venda),
      valorVenda: Number((v as Record<string, unknown>).valor_venda),
      valorCompra: compra ? Number((compra as Record<string, unknown>).valor_compra) : null,
      despesas: (despesas ?? []).map((d: Record<string, unknown>) => ({
        valor: Number(d.valor),
        categoria: String(d.categoria ?? ""),
      })),
    });
  }
  return lines;
}

function normalize(text: string): string {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export async function runGestaoAssistenteQuery(
  sb: Db,
  userId: string,
  message: string,
): Promise<GestaoAssistenteQueryResult | null> {
  const t = normalize(message);
  const competencia = competenciaFromDate();
  const today = new Date().toISOString().slice(0, 10);

  if (/\bparado|mais tempo|envelhec|dias no estoque\b/.test(t)) {
    const { data: veiculos } = await sb.from("veiculos_estoque").select("id, marca, modelo, versao, status, created_at")
      .eq("user_id", userId).eq("status", "disponivel");
    const rows = (veiculos ?? []) as Array<Record<string, unknown>>;
    const now = Date.now();
    const ranked = rows
      .map((v) => {
        const created = Date.parse(String(v.created_at ?? ""));
        const days = Number.isFinite(created) ? Math.floor((now - created) / 86400000) : 0;
        return { v, days };
      })
      .filter((x) => x.days >= 30)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
    const lines = ranked.map(({ v, days }) =>
      `${formatGestaoVeiculoLabel(v as never)} — ${days} dias`
    );
    return {
      queryKind: "carros_parados",
      reply: lines.length
        ? `Carros há mais tempo no estoque:\n${lines.join("\n")}`
        : "Nenhum carro disponível com mais de 30 dias — ótimo giro!",
      facts: { qtd: ranked.length, competencia },
    };
  }

  if (/\bfaturei\b|\bfaturamento\b/.test(t) && /\b(mes|mês)\b/.test(t)) {
    const vendas = await loadVendasDreMes(sb, userId, competencia);
    const faturamento = vendas.reduce((a, v) => a + v.valorVenda, 0);
    return {
      queryKind: "faturamento_mes",
      reply: `Faturamento em ${competencia}: ${formatGestaoMoney(faturamento)} em ${vendas.length} venda(s).`,
      facts: { faturamento, qtd_vendas: vendas.length, competencia },
    };
  }

  const intent = classifyGestaoIntent(message);
  if (intent.kind === "none") return null;
  if (isGestaoAssistenteMutatingIntent(intent.kind)) return null;

  if (intent.kind === "lucro_mes") {
    const vendas = await loadVendasDreMes(sb, userId, competencia);
    const faturamento = vendas.reduce((a, v) => a + v.valorVenda, 0);
    return {
      queryKind: "faturamento_mes",
      reply: `Faturamento em ${competencia}: ${formatGestaoMoney(faturamento)} em ${vendas.length} venda(s).`,
      facts: { faturamento, qtd_vendas: vendas.length, competencia },
    };
  }

  if (intent.kind === "lucro_loja_mes") {
    const contas = await loadContas(sb, userId);
    const vendas = await loadVendasDreMes(sb, userId, competencia);
    const ops = contasToDreOperacionalRows(contas.map((c) => ({
      tipo: c.tipo,
      categoria_operacional: c.categoria,
      valor: c.valor,
      vencimento: c.vencimento,
      pago_em: c.pago_em,
    })));
    const dre = calcDreMes(competencia, vendas, ops);
    return {
      queryKind: "lucro_loja_mes",
      reply: buildLucroLojaMesReply(competencia, vendas, ops),
      facts: { lucro_liquido: dre.lucroLiquidoLoja, faturamento: dre.faturamento, competencia },
    };
  }

  if (intent.kind === "contas_amanha") {
    const contas = await loadContas(sb, userId);
    return {
      queryKind: "contas_amanha",
      reply: buildContasVencemAmanhaReply(contas, today),
      facts: { competencia },
    };
  }

  if (intent.kind === "contas_semana") {
    const contas = await loadContas(sb, userId);
    return {
      queryKind: "contas_semana",
      reply: buildContasSemanaReply(contas, today),
      facts: { competencia },
    };
  }

  if (intent.kind === "a_receber") {
    const contas = await loadContas(sb, userId);
    return {
      queryKind: "a_receber",
      reply: buildAReceberReply(contas),
      facts: { competencia },
    };
  }

  if (intent.kind === "conciliacao_pendente") {
    const { data } = await sb.from("gestao_extrato_transacao").select("valor, status")
      .eq("user_id", userId).in("status", ["pendente", "confirmar"]);
    const rows = data ?? [];
    const qtd = rows.length;
    const valor = (rows as Array<{ valor: number }>).reduce((a, r) => a + Number(r.valor), 0);
    return {
      queryKind: "conciliacao_pendente",
      reply: buildConciliacaoPendenteReply(qtd, valor),
      facts: { qtd, valor_total: valor },
    };
  }

  if (intent.kind === "contratos_pendentes") {
    const { count } = await sb.from("gestao_contrato").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "pendente_assinatura");
    return {
      queryKind: "contratos_pendentes",
      reply: buildContratosPendentesReply(count ?? 0),
      facts: { pendentes: count ?? 0 },
    };
  }

  if (intent.kind === "notas_mes") {
    const start = `${competencia}-01`;
    const [y, m] = competencia.split("-").map(Number);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const { data } = await sb.from("gestao_nfe").select("status, authorized_at, created_at")
      .eq("user_id", userId);
    const filtered = (data ?? []).filter((n: Record<string, unknown>) => {
      const d = String(n.authorized_at ?? n.created_at ?? "").slice(0, 10);
      return d >= start && d <= end;
    });
    const autorizadas = filtered.filter((n: Record<string, unknown>) =>
      String(n.status ?? "") === "authorized" || String(n.status ?? "") === "autorizada"
    ).length;
    return {
      queryKind: "notas_mes",
      reply: buildNotasMesReply({
        competencia,
        total: filtered.length,
        autorizadas,
      }),
      facts: { qtd: filtered.length, competencia },
    };
  }

  if (intent.kind === "ranking_vendedores" || intent.kind === "comissao_mes" || intent.kind === "vendedor_mes") {
    const { data: vendedores } = await sb.from("gestao_vendedores").select("id, nome, ativo")
      .eq("user_id", userId).eq("ativo", true);
    const comissaoMap = await loadComissaoMesMap(sb, userId, competencia);
    if (intent.kind === "ranking_vendedores") {
      return {
        queryKind: "ranking_vendedores",
        reply: await buildGestaoRankingReply(sb, userId, comissaoMap, vendedores ?? [], competencia),
        facts: { competencia },
      };
    }
    return {
      queryKind: "comissao_mes",
      reply: buildComissaoMesReply(comissaoMap, vendedores ?? [], competencia),
      facts: { competencia },
    };
  }

  if (intent.kind === "nfe_emit" || intent.kind === "venda" || intent.kind === "despesa") {
    return null;
  }

  return null;
}

async function loadComissaoMesMap(sb: Db, userId: string, competencia: string): Promise<Map<string, number>> {
  const start = `${competencia}-01`;
  const [y, m] = competencia.split("-").map(Number);
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const ids = (vendas ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (!ids.length) return new Map();
  const { data: autos } = await sb.from("gestao_comissao_auto").select("vendedor_id, valor")
    .eq("user_id", userId).in("veiculo_id", ids);
  const map = new Map<string, number>();
  for (const a of autos ?? []) {
    const row = a as { vendedor_id: string; valor: number };
    map.set(row.vendedor_id, (map.get(row.vendedor_id) ?? 0) + Number(row.valor));
  }
  return map;
}

export async function runGestaoAssistenteEstoqueValores(
  sb: Db,
  userId: string,
): Promise<GestaoAssistenteQueryResult> {
  const { data: veiculos } = await sb.from("veiculos_estoque").select("id, preco, status")
    .eq("user_id", userId).eq("status", "disponivel");
  const ids = (veiculos ?? []).map((v: { id: string }) => v.id);
  let compraTotal = 0;
  let comCompra = 0;
  for (const id of ids) {
    const { data: compra } = await sb.from("veiculo_compra").select("valor_compra")
      .eq("user_id", userId).eq("veiculo_id", id).maybeSingle();
    if (compra?.valor_compra != null) {
      comCompra += 1;
      compraTotal += Number(compra.valor_compra);
    }
  }
  const vitrine = (veiculos ?? []).reduce((a: number, v: { preco: number | null }) =>
    a + Number(v.preco ?? 0), 0);
  return {
    queryKind: "estoque_valores",
    reply: `Estoque disponível: ${ids.length} carro(s). ` +
      `${comCompra} com valor de compra (${formatGestaoMoney(compraTotal)}). ` +
      `Soma preços de vitrine: ${formatGestaoMoney(vitrine)}.`,
    facts: { qtd: ids.length, com_compra: comCompra, compra_total: compraTotal, vitrine_total: vitrine },
  };
}

export function matchEstoqueValoresQuestion(text: string): boolean {
  const t = normalize(text);
  return /\bestoque\b/.test(t) && /\b(valor|valores|quanto|dinheiro)\b/.test(t);
}
