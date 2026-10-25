import { classifyGestaoIntent, type GestaoIntentKind } from "./gestao-intent-pt.ts";
import { competenciaFromDate } from "./gestao-meta-calc.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { calcDreMes, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import { hojeSaoPaulo, intervaloCompetencia } from "./gestao-date-br.ts";
import { VEICULO_STATUS_ATIVOS_INTERNOS } from "./veiculo-estoque-status.ts";
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
import { buildRankingVendedores, type VendaEquipeLine } from "./gestao-equipe-stats.ts";
import { formatGestaoVeiculoLabel, type GestaoVeiculoRow } from "./gestao-veiculo-match.ts";
import type { GestaoVendedorRow } from "./gestao-vendedor-match.ts";
import type { Db } from "./gestao-assistente-core.ts";
import {
  formatPosicaoLojaPainel,
  formatRelatorioVendedoresWhatsApp,
  formatVendedorDetalheWhatsApp,
  loadPosicaoLojaFacts,
  loadRelatorioVendedoresFacts,
  lojaNomeFromText,
} from "./gestao-posicao-loja.ts";
import {
  formatGestaoDreWhatsApp,
  loadGestaoDreWhatsappFacts,
  parseGestaoCompetenciaFromText,
} from "./gestao-dre-whatsapp.ts";

export type GestaoAssistenteQueryResult = {
  queryKind: string;
  reply: string;
  facts: Record<string, string | number | boolean>;
};

type ContaLancamentoRow = {
  id: string;
  tipo: "pagar" | "receber";
  natureza: string;
  categoria_operacional: string | null;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  recebido_em: string | null;
  observacao: string | null;
};

type VendaRow = {
  veiculo_id: string;
  valor_venda: number;
  data_venda: string;
};

type CompraValorRow = { valor_compra: number | null };

type DespesaRow = { valor: number; categoria: string };

type VeiculoEstoqueParadoRow = Pick<
  GestaoVeiculoRow,
  "id" | "marca" | "modelo" | "versao" | "status"
> & { created_at?: string | null };

type VeiculoEstoquePrecoRow = { id: string; preco: number | null; status: string };

type ExtratoRow = { valor: number; status: string };

type NfeRow = {
  status: string | null;
  authorized_at: string | null;
  created_at: string | null;
};

type VendaVeiculoIdRow = { veiculo_id: string };

type ComissaoAutoRow = { vendedor_id: string; valor: number };

type VendaEquipeRawRow = {
  veiculo_id: string;
  valor_venda: number;
  data_venda: string;
  vendedor_id: string | null;
};

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
    "id, tipo, natureza, categoria_operacional, valor, vencimento, pago_em, recebido_em, observacao",
  ).eq("user_id", userId).is("deleted_at", null);
  const rows = (data ?? []) as ContaLancamentoRow[];
  return rows.map((c) => ({
    id: String(c.id),
    tipo: c.tipo,
    natureza: c.natureza ?? "operacional",
    categoria: String(c.categoria_operacional ?? ""),
    valor: Number(c.valor),
    vencimento: String(c.vencimento ?? ""),
    pago_em: c.pago_em ? String(c.pago_em) : null,
    recebido_em: c.recebido_em ? String(c.recebido_em) : null,
    observacao: c.observacao ? String(c.observacao) : null,
  }));
}

async function buildGestaoAssistenteRankingReply(
  sb: Db,
  userId: string,
  comissaoByVendedor: Map<string, number>,
  vendedores: GestaoVendedorRow[],
  competencia: string,
): Promise<string> {
  const { start, end } = intervaloCompetencia(competencia);

  const { data: vendasRaw } = await sb.from("veiculo_venda").select(
    "veiculo_id, valor_venda, data_venda, vendedor_id",
  ).eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);

  const vendas: VendaEquipeLine[] = ((vendasRaw ?? []) as VendaEquipeRawRow[]).map((row) => ({
    veiculo_id: row.veiculo_id,
    valor_venda: Number(row.valor_venda),
    data_venda: String(row.data_venda),
    vendedor_id: row.vendedor_id,
    lucro_liquido: null,
  }));

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

function buildComissaoMesReply(
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

async function loadVendasDreMes(sb: Db, userId: string, competencia: string): Promise<GestaoVendaDreLine[]> {
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const vendaRows = (vendas ?? []) as VendaRow[];
  const lines: GestaoVendaDreLine[] = [];
  for (const v of vendaRows) {
    const vid = v.veiculo_id;
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra").eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const compraRow = compra as CompraValorRow | null;
    const despesaRows = (despesas ?? []) as DespesaRow[];
    lines.push({
      veiculoId: vid,
      dataVenda: String(v.data_venda),
      valorVenda: Number(v.valor_venda),
      valorCompra: compraRow?.valor_compra != null ? Number(compraRow.valor_compra) : null,
      despesas: despesaRows.map((d) => ({
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
  const today = hojeSaoPaulo();

  if (/\bparado|mais tempo|envelhec|dias no estoque\b/.test(t)) {
    const { data: veiculos } = await sb.from("veiculos_estoque").select("id, marca, modelo, versao, status, created_at")
      .eq("user_id", userId).in("status", [...VEICULO_STATUS_ATIVOS_INTERNOS]);
    const rows = (veiculos ?? []) as VeiculoEstoqueParadoRow[];
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
      `${formatGestaoVeiculoLabel(v as GestaoVeiculoRow)} — ${days} dias`
    );
    return {
      queryKind: "carros_parados",
      reply: lines.length
        ? `Carros há mais tempo no estoque:\n${lines.join("\n")}`
        : "Nenhum carro ativo com mais de 30 dias — ótimo giro!",
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

  const agoraSP = new Date();
  const lojaNomeCitada = lojaNomeFromText(message);
  const posicaoOpts = { lojaNomeCitada, storeUserId: userId };

  if (intent.kind === "dre_whatsapp") {
    const competencia = parseGestaoCompetenciaFromText(message, agoraSP);
    const facts = await loadGestaoDreWhatsappFacts(sb, userId, competencia, agoraSP);
    return {
      queryKind: "dre_whatsapp",
      reply: formatGestaoDreWhatsApp(facts),
      facts: { competencia, vendas: facts.dre.qtdVendas },
    };
  }
  if (intent.kind === "posicao_loja") {
    const facts = await loadPosicaoLojaFacts(sb, userId, agoraSP, posicaoOpts);
    return {
      queryKind: "posicao_loja",
      reply: formatPosicaoLojaPainel(facts),
      facts: {
        vendas_mes: facts.mes.qtdVendas,
        estoque_qtd: facts.estoque.qtd,
        competencia: facts.competencia,
      },
    };
  }
  if (intent.kind === "relatorio_vendedores") {
    const facts = await loadRelatorioVendedoresFacts(sb, userId, agoraSP, posicaoOpts);
    return {
      queryKind: "relatorio_vendedores",
      reply: formatRelatorioVendedoresWhatsApp(facts),
      facts: { vendedores: facts.ranking.length, competencia: facts.competencia },
    };
  }
  if (intent.kind === "vendedor_detalhe") {
    const reply = await formatVendedorDetalheWhatsApp(
      sb,
      userId,
      intent.vendedorHint,
      agoraSP,
      posicaoOpts,
    );
    return {
      queryKind: "vendedor_detalhe",
      reply,
      facts: { hint_len: intent.vendedorHint.length, competencia: competenciaFromDate(agoraSP) },
    };
  }

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
      natureza: c.natureza,
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
    const rows = (data ?? []) as ExtratoRow[];
    const qtd = rows.length;
    const valor = rows.reduce((a, r) => a + Number(r.valor), 0);
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
    const { start, end } = intervaloCompetencia(competencia);
    const { data } = await sb.from("gestao_nfe").select("status, authorized_at, created_at")
      .eq("user_id", userId);
    const allRows = (data ?? []) as NfeRow[];
    const filtered = allRows.filter((n) => {
      const d = String(n.authorized_at ?? n.created_at ?? "").slice(0, 10);
      return d >= start && d <= end;
    });
    const autorizadas = filtered.filter((n) =>
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
    const vendedorRows = (vendedores ?? []) as GestaoVendedorRow[];
    const comissaoMap = await loadComissaoMesMap(sb, userId, competencia);
    if (intent.kind === "ranking_vendedores") {
      return {
        queryKind: "ranking_vendedores",
        reply: await buildGestaoAssistenteRankingReply(
          sb,
          userId,
          comissaoMap,
          vendedorRows,
          competencia,
        ),
        facts: { competencia },
      };
    }
    return {
      queryKind: "comissao_mes",
      reply: buildComissaoMesReply(comissaoMap, vendedorRows, competencia),
      facts: { competencia },
    };
  }

  if (intent.kind === "nfe_emit" || intent.kind === "venda" || intent.kind === "despesa") {
    return null;
  }

  return null;
}

async function loadComissaoMesMap(sb: Db, userId: string, competencia: string): Promise<Map<string, number>> {
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const vendaRows = (vendas ?? []) as VendaVeiculoIdRow[];
  const ids = vendaRows.map((v) => v.veiculo_id);
  if (!ids.length) return new Map();
  const { data: autos } = await sb.from("gestao_comissao_auto").select("vendedor_id, valor")
    .eq("user_id", userId).in("veiculo_id", ids);
  const autoRows = (autos ?? []) as ComissaoAutoRow[];
  const map = new Map<string, number>();
  for (const a of autoRows) {
    map.set(a.vendedor_id, (map.get(a.vendedor_id) ?? 0) + Number(a.valor));
  }
  return map;
}

export async function runGestaoAssistenteEstoqueValores(
  sb: Db,
  userId: string,
): Promise<GestaoAssistenteQueryResult> {
  const { data: veiculos } = await sb.from("veiculos_estoque").select("id, preco, status")
    .eq("user_id", userId).in("status", [...VEICULO_STATUS_ATIVOS_INTERNOS]);
  const veiculoRows = (veiculos ?? []) as VeiculoEstoquePrecoRow[];
  const ids = veiculoRows.map((v) => v.id);
  let compraTotal = 0;
  let comCompra = 0;
  for (const id of ids) {
    const { data: compra } = await sb.from("veiculo_compra").select("valor_compra")
      .eq("user_id", userId).eq("veiculo_id", id).maybeSingle();
    const compraRow = compra as CompraValorRow | null;
    if (compraRow?.valor_compra != null) {
      comCompra += 1;
      compraTotal += Number(compraRow.valor_compra);
    }
  }
  const vitrine = veiculoRows.reduce((a, v) => a + Number(v.preco ?? 0), 0);
  return {
    queryKind: "estoque_valores",
    reply: `Estoque interno ativo: ${ids.length} carro(s). ` +
      `${comCompra} com valor de compra (${formatGestaoMoney(compraTotal)}). ` +
      `Soma preços de vitrine: ${formatGestaoMoney(vitrine)}.`,
    facts: { qtd: ids.length, com_compra: comCompra, compra_total: compraTotal, vitrine_total: vitrine },
  };
}

export function matchEstoqueValoresQuestion(text: string): boolean {
  const t = normalize(text);
  return /\bestoque\b/.test(t) && /\b(valor|valores|quanto|dinheiro)\b/.test(t);
}
