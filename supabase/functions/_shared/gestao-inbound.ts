import { calcGestaoLucro } from "./gestao-lucro-calc.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { hojeSaoPaulo, intervaloCompetencia, intervaloMesAtualSaoPaulo } from "./gestao-date-br.ts";
import {
  isGestaoAuthorizedPhone,
  loadGestaoAuthContext,
  maskGestaoPhone,
  type GestaoAuthContext,
} from "./gestao-auth-phone.ts";
import {
  classifyGestaoIntent,
  isGestaoAffirmative,
  isGestaoNegative,
  parseGestaoDisambiguationPick,
  type GestaoIntent,
} from "./gestao-intent-pt.ts";
import {
  gestaoDespesaCategoriaLabel,
  resolveGestaoCategoriaFromUserReply,
} from "./gestao-categoria-pt.ts";
import {
  formatGestaoVeiculoLabel,
  rankGestaoVeiculoMatches,
  type GestaoVeiculoRow,
} from "./gestao-veiculo-match.ts";
import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";
import {
  calcGestaoComissao,
  DEFAULT_COMISSAO_REGRA,
  normalizeComissaoRegra,
  type GestaoComissaoRegraJson,
} from "./gestao-comissao-calc.ts";
import {
  lucroLiquidoAntesComissaoAuto,
  margemPctAntesComissaoAuto,
} from "./gestao-lucro-comissao-base.ts";
import { applyGestaoComissaoSync, estornarComissaoAuto } from "./gestao-comissao-sync.ts";
import {
  buildComissaoMesReply,
  buildGestaoRankingReply,
  buildGestaoVendedorMesReply,
} from "./gestao-equipe-inbound.ts";
import { matchGestaoVendedor, type GestaoVendedorRow } from "./gestao-vendedor-match.ts";
import { competenciaFromDate } from "./gestao-meta-calc.ts";
import {
  calcVendaRaioX,
  formatRaioXWhatsApp,
  rankPioresNegocios,
  type GestaoVendaRaioXRankItem,
} from "./gestao-venda-raio-x.ts";
import {
  buildAReceberReply,
  buildContadorLinkReply,
  buildContasSemanaReply,
  buildContasVencemAmanhaReply,
  buildLucroLojaMesReply,
  buildRevogarContadorLinkReply,
  type GestaoContaInbound,
} from "./gestao-financeiro-inbound.ts";
import { buildConciliacaoPendenteReply } from "./gestao-conciliacao-inbound.ts";
import {
  buildContratoStatusReply,
  buildContratosPendentesReply,
} from "./gestao-contrato-inbound.ts";
import type { GestaoNfeTomadorInput } from "./gestao-nfe-build.ts";
import {
  inferNfeTipoOperacao,
  loadTomadorForNfe,
  loadVeiculoNfeFields,
  resolveNfeValorTotal,
  tomadorMissingFields,
} from "./gestao-nfe-context.ts";
import {
  buildJarvisNfePreview,
  buildNfeEmitBlockedMessage,
  buildNfeEmitSuccessReply,
  buildNotasMesReply,
  buildNfeStatusReply,
} from "./gestao-nfe-inbound.ts";
import {
  emitGestaoNfe,
  loadFocusTokenForUser,
  loadNfeConfig,
  operacaoFromConfig,
} from "./gestao-nfe-service.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import { mintGestaoContadorLink } from "./gestao-contador-link.ts";
import { syncRecorrenciaLancamentosDb } from "./gestao-recorrencia-db-sync.ts";
import type { GestaoVendaDreLine } from "./gestao-dre-calc.ts";
export const GESTAO_PENDING_TTL_MS = 10 * 60 * 1000;
export const GESTAO_DESFAZER_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingGestaoConfirm = {
  phase: "disambiguation" | "confirm" | "desfazer_confirm";
  action: GestaoIntent["kind"];
  draft: Record<string, unknown>;
  expires_at: string;
  options?: Array<{ n: number; veiculo_id: string; label: string }>;
  disambiguation_warned?: boolean;
};

const GESTAO_VEHICLE_SELECT =
  "id,marca,modelo,versao,ano_modelo,cor,placa,status,preco";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GestaoDb = { from: (table: string) => any };

function pendingActive(pending: PendingGestaoConfirm | null | undefined): boolean {
  if (!pending?.expires_at) return false;
  const exp = Date.parse(pending.expires_at);
  return Number.isFinite(exp) && Date.now() < exp;
}

function formatBrl(value: number): string {
  return formatGestaoMoney(value);
}

async function loadVendedores(sb: unknown, userId: string): Promise<GestaoVendedorRow[]> {
  const client = sb as GestaoDb;
  const { data } = await client.from("gestao_vendedores").select("id, nome, ativo, is_gerente")
    .eq("user_id", userId).eq("ativo", true);
  return (data ?? []) as GestaoVendedorRow[];
}

async function loadRegraComissao(
  sb: unknown,
  userId: string,
  vendedorId: string | null,
): Promise<GestaoComissaoRegraJson> {
  const client = sb as GestaoDb;
  const q = client.from("gestao_comissao_regra").select("regra_json").eq("user_id", userId);
  const { data } = vendedorId
    ? await q.eq("vendedor_id", vendedorId).maybeSingle()
    : await q.is("vendedor_id", null).maybeSingle();
  const row = data as { regra_json?: GestaoComissaoRegraJson } | null;
  return normalizeComissaoRegra(row?.regra_json ?? DEFAULT_COMISSAO_REGRA);
}

async function loadComissaoMesMap(
  sb: unknown,
  userId: string,
  competencia: string,
): Promise<Map<string, number>> {
  const client = sb as GestaoDb;
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendas } = await client.from("veiculo_venda").select("veiculo_id")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const ids = (vendas ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (!ids.length) return new Map();
  const { data: autos } = await client.from("gestao_comissao_auto").select("vendedor_id, valor")
    .eq("user_id", userId).in("veiculo_id", ids);
  const map = new Map<string, number>();
  for (const a of autos ?? []) {
    const row = a as { vendedor_id: string; valor: number };
    map.set(row.vendedor_id, (map.get(row.vendedor_id) ?? 0) + Number(row.valor));
  }
  return map;
}

async function loadVehicles(
  sb: unknown,
  userId: string,
): Promise<GestaoVeiculoRow[]> {
  const client = sb as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: GestaoVeiculoRow[] | null }>;
      };
    };
  };
  const { data } = await client.from("veiculos_estoque").select(GESTAO_VEHICLE_SELECT)
    .eq("user_id", userId);
  return data ?? [];
}

async function fetchLucroVeiculo(
  sb: unknown,
  userId: string,
  veiculoId: string,
  veiculo: GestaoVeiculoRow,
): Promise<string> {
  const client = sb as GestaoDb;
  const [{ data: compra }, { data: despesas }, { data: venda }] = await Promise.all([
    client.from("veiculo_compra").select("valor_compra, data_compra")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
    client.from("veiculo_despesas").select("valor, categoria")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null),
    client.from("veiculo_venda").select("valor_venda, data_venda")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
  ]);
  const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
    valor: Number(d.valor),
    categoria: String(d.categoria ?? ""),
  }));
  const lucro = calcGestaoLucro({
    valorCompra: compra ? Number(compra.valor_compra) : null,
    despesas: dList,
    valorVenda: venda ? Number(venda.valor_venda) : null,
    precoAnunciado: veiculo.preco != null ? Number(veiculo.preco) : null,
    dataCompra: compra ? String(compra.data_compra) : null,
    dataVenda: venda ? String(venda.data_venda) : null,
    statusVeiculo: veiculo.status ?? "disponivel",
  });
  const label = formatGestaoVeiculoLabel(veiculo);
  if (lucro.vendido && lucro.lucroLiquido != null) {
    return `${label}: lucro líquido ${formatBrl(lucro.lucroLiquido)} (margem ${
      lucro.margemPct?.toFixed(1) ?? "—"
    }%).`;
  }
  const investidoTxt = lucro.investido != null
    ? formatBrl(lucro.investido)
    : "custo pendente";
  return `${label}: lucro projetado ${formatGestaoMoney(lucro.lucroProjetado)} (investido ${investidoTxt}).`;
}

async function fetchVendaRaioxVeiculo(
  sb: unknown,
  userId: string,
  veiculoId: string,
  veiculo: GestaoVeiculoRow,
): Promise<string> {
  const client = sb as GestaoDb;
  const [{ data: compra }, { data: despesas }, { data: venda }] = await Promise.all([
    client.from("veiculo_compra").select("valor_compra")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
    client.from("veiculo_despesas").select("valor, categoria")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null),
    client.from("veiculo_venda").select("valor_venda")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
  ]);
  if (!venda) {
    return `${formatGestaoVeiculoLabel(veiculo)} ainda não tem venda registrada.`;
  }
  const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
    valor: Number(d.valor),
    categoria: String(d.categoria ?? ""),
  }));
  const raio = calcVendaRaioX({
    valorVenda: Number(venda.valor_venda),
    valorCompra: compra ? Number(compra.valor_compra) : null,
    despesas: dList,
  });
  if (!raio) return "Não consegui calcular o raio-X desta venda.";
  return formatRaioXWhatsApp(formatGestaoVeiculoLabel(veiculo), raio);
}

async function fetchPioresNegociosMes(sb: unknown, userId: string): Promise<string> {
  const now = new Date();
  const { start, end } = intervaloMesAtualSaoPaulo(now);
  const client = sb as GestaoDb;
  const vehicles = await loadVehicles(sb, userId);
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const { data: vendas } = await client.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const items: GestaoVendaRaioXRankItem[] = [];
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const veiculo = byId.get(vid);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      client.from("veiculo_compra").select("valor_compra")
        .eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      client.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
      valor: Number(d.valor),
      categoria: String(d.categoria ?? ""),
    }));
    const raio = calcVendaRaioX({
      valorVenda: Number(v.valor_venda),
      valorCompra: compra ? Number(compra.valor_compra) : null,
      despesas: dList,
    });
    if (!raio || raio.lucroFinal == null) continue;
    items.push({
      ...raio,
      veiculoId: vid,
      label: veiculo ? formatGestaoVeiculoLabel(veiculo) : vid,
      vendedorId: null,
      vendedorNome: null,
      dataVenda: String(v.data_venda),
    });
  }
  const worst = rankPioresNegocios(items, 3);
  if (!worst.length) return "Nenhuma venda no mês com lucro calculável.";
  const lines = worst.map((w, i) => {
    const motivo = w.motivoProvavel ? ` — ${w.motivoProvavel}` : "";
    return `${i + 1}. ${w.label}: lucro final ${formatBrl(w.lucroFinal ?? 0)} (comissão ${formatBrl(w.comissao)})${motivo}`;
  });
  return `Piores negócios do mês:\n${lines.join("\n")}`;
}

async function fetchDespesasVeiculo(
  sb: unknown,
  userId: string,
  veiculoId: string,
  veiculo: GestaoVeiculoRow,
): Promise<string> {
  const client = sb as GestaoDb;
  const { data } = await client.from("veiculo_despesas").select("data, categoria, valor, descricao")
    .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null)
    .order("data", { ascending: false });
  const lines = (data ?? []).slice(0, 8).map((d: Record<string, unknown>) =>
    `${d.data}: ${formatBrl(Number(d.valor))} (${gestaoDespesaCategoriaLabel(String(d.categoria ?? ""))})`
  );
  const label = formatGestaoVeiculoLabel(veiculo);
  if (!lines.length) return `${label}: nenhuma despesa registrada.`;
  return `${label} — despesas:\n${lines.join("\n")}`;
}

async function loadContasInbound(sb: unknown, userId: string): Promise<GestaoContaInbound[]> {
  const client = sb as GestaoDb;
  await syncRecorrenciaLancamentosDb(client, userId);
  const { data } = await client.from("gestao_conta_lancamento").select(
    "id, tipo, valor, vencimento, pago_em, recebido_em, recorrencia_dia_mes, categoria_operacional, observacao",
  ).eq("user_id", userId).is("deleted_at", null);
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    tipo: c.tipo as "pagar" | "receber",
    valor: Number(c.valor),
    vencimento: String(c.vencimento),
    pago_em: c.pago_em ? String(c.pago_em) : null,
    recebido_em: c.recebido_em ? String(c.recebido_em) : null,
    recorrencia_dia_mes: c.recorrencia_dia_mes != null ? Number(c.recorrencia_dia_mes) : null,
    categoria: String(c.categoria_operacional),
    observacao: c.observacao ? String(c.observacao) : null,
  }));
}

async function loadVendasDreMes(sb: unknown, userId: string, competencia: string): Promise<GestaoVendaDreLine[]> {
  const { start, end } = intervaloCompetencia(competencia);
  const client = sb as GestaoDb;
  const { data: vendas } = await client.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const lines: GestaoVendaDreLine[] = [];
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      client.from("veiculo_compra").select("valor_compra").eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      client.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    lines.push({
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
  return lines;
}

async function fetchLucroMes(sb: unknown, userId: string): Promise<string> {
  const now = new Date();
  const { start, end } = intervaloMesAtualSaoPaulo(now);
  const client = sb as GestaoDb;
  const { data: vendas } = await client.from("veiculo_venda").select("veiculo_id, valor_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  let lucro = 0;
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const valorVenda = Number(v.valor_venda);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      client.from("veiculo_compra").select("valor_compra")
        .eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      client.from("veiculo_despesas").select("valor")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const compraVal = compra ? Number(compra.valor_compra) : 0;
    const desp = (despesas ?? []).reduce(
      (acc: number, d: Record<string, unknown>) => acc + Number(d.valor),
      0,
    );
    lucro += valorVenda - compraVal - desp;
  }
  return `Lucro do mês (vendas registradas): ${formatBrl(lucro)}.`;
}

function buildConfirmMessage(
  action: GestaoIntent["kind"],
  veiculo: GestaoVeiculoRow,
  draft: Record<string, unknown>,
): string {
  const label = formatGestaoVeiculoLabel(veiculo);
  if (action === "despesa") {
    const catCode = String(draft.categoria ?? "outros");
    const catLabel = gestaoDespesaCategoriaLabel(catCode);
    const outrosHint = catCode === "outros"
      ? "\nSe for outra categoria, responda com o nome (ex.: mecânica)."
      : "";
    return `Confirmar despesa de ${formatBrl(Number(draft.valor))} (${catLabel}) no ${label}?${outrosHint}\nResponda SIM ou NÃO.`;
  }
  if (action === "compra") {
    const origem = draft.consignacao ? "consignação" : "compra";
    return `Confirmar ${origem} de ${formatBrl(Number(draft.valor))} no ${label}?\nResponda SIM ou NÃO.`;
  }
  if (action === "nfe_emit") {
    return String(draft.preview_resumo ?? "Confirmar emissão de NF-e?\nResponda SIM ou NÃO.");
  }
  if (action === "venda") {
    const comissao = draft.comissao_preview != null
      ? formatBrl(Number(draft.comissao_preview))
      : null;
    const vend = draft.vendedor_nome ? `\nVendedor: ${draft.vendedor_nome}.` : "";
    const comTxt = comissao ? `\nComissão estimada: ${comissao} (lançada no carro se confirmar).` : "";
    return `Confirmar venda de ${formatBrl(Number(draft.valor))} no ${label}?${vend}${comTxt}\nResponda SIM ou NÃO.`;
  }
  return `Confirmar?\nResponda SIM ou NÃO.`;
}

async function enrichVendaDraft(
  sb: unknown,
  userId: string,
  veiculoId: string,
  draft: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const vendedores = await loadVendedores(sb, userId);
  const hint = String(draft.vendedor_hint ?? "");
  const matched = hint ? matchGestaoVendedor(hint, vendedores) : null;
  const out: Record<string, unknown> = { ...draft, veiculo_id: veiculoId };
  if (!matched) return out;

  out.vendedor_id = matched.id;
  out.vendedor_nome = matched.nome;

  const client = sb as GestaoDb;
  const [{ data: compra }, { data: despesas }] = await Promise.all([
    client.from("veiculo_compra").select("valor_compra, data_compra")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
    client.from("veiculo_despesas").select("valor, categoria, origem_lancamento")
      .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null),
  ]);
  const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
    valor: Number(d.valor),
    categoria: String(d.categoria ?? ""),
    origem_lancamento: String(d.origem_lancamento ?? ""),
  }));
  const compraVal = compra ? Number(compra.valor_compra) : null;
  const valorVenda = Number(draft.valor);
  const lucroLiquido = lucroLiquidoAntesComissaoAuto({
    valorCompra: compraVal,
    valorVenda,
    despesas: dList,
  });
  const margemPct = margemPctAntesComissaoAuto(lucroLiquido, valorVenda);

  const regra = await loadRegraComissao(sb, userId, matched.id);
  const prev = calcGestaoComissao({
    valorVenda,
    lucroLiquido,
    margemPct,
    regra,
  });
  out.comissao_preview = prev.total;
  return out;
}

async function recordWhatsappLancamento(
  sb: unknown,
  userId: string,
  fromNumber: string,
  tipo: string,
  referenciaId: string | null,
  referenciaTabela: string | null,
) {
  const client = sb as {
    from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
  };
  await client.from("gestao_lancamentos_whatsapp").insert({
    user_id: userId,
    telefone_mascarado: maskGestaoPhone(fromNumber),
    tipo,
    referencia_id: referenciaId,
    referencia_tabela: referenciaTabela,
  });
}

async function persistDraft(
  sb: unknown,
  userId: string,
  fromNumber: string,
  action: GestaoIntent["kind"],
  veiculoId: string,
  draft: Record<string, unknown>,
): Promise<string> {
  const today = hojeSaoPaulo();
  const client = sb as GestaoDb;

  if (action === "despesa") {
    const { data, error } = await client.from("veiculo_despesas").insert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor: draft.valor,
      data: today,
      categoria: draft.categoria,
      descricao: draft.descricao ?? null,
      origem_lancamento: "whatsapp_texto",
      lancado_por: maskGestaoPhone(fromNumber),
    }).select("id").single();
    if (error) throw new Error(error.message);
    await recordWhatsappLancamento(
      sb,
      userId,
      fromNumber,
      "despesa",
      data?.id ?? null,
      "veiculo_despesas",
    );
    return "Despesa registrada.";
  }

  if (action === "compra") {
    const { error } = await client.from("veiculo_compra").upsert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor_compra: draft.valor,
      data_compra: today,
      origem: draft.consignacao ? "consignacao" : "compra",
    }, { onConflict: "user_id,veiculo_id" });
    if (error) throw new Error(error.message);
    await recordWhatsappLancamento(sb, userId, fromNumber, "compra", veiculoId, "veiculo_compra");
    return "Compra registrada.";
  }

  if (action === "nfe_emit") {
    const tomador = draft.tomador as GestaoNfeTomadorInput;
    const tipo = String(draft.tipo_operacao) as "entrada_compra_pf" | "saida_venda" | "consignacao";
    const veiculo = draft.veiculo_nfe as Awaited<ReturnType<typeof loadVeiculoNfeFields>>;
    const valorTotal = Number(draft.valor_total);
    const result = await emitGestaoNfe({
      client,
      userId,
      veiculoId,
      tipo,
      valorTotal,
      tomador,
      veiculo: veiculo!,
    });
    await recordWhatsappLancamento(sb, userId, fromNumber, "nfe_emit", result.nfeId, "gestao_nfe");
    const vehicles = await loadVehicles(sb, userId);
    const veiculoRow = vehicles.find((v) => v.id === veiculoId);
    return buildNfeEmitSuccessReply({
      status: result.status,
      veiculoLabel: veiculoRow ? formatGestaoVeiculoLabel(veiculoRow) : "veículo",
    });
  }

  if (action === "venda") {
    const vendedorId = draft.vendedor_id ? String(draft.vendedor_id) : null;
    const vendedorNome = draft.vendedor_nome ? String(draft.vendedor_nome) : null;
    const { error } = await client.from("veiculo_venda").upsert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor_venda: draft.valor,
      data_venda: today,
      vendedor: vendedorNome,
      vendedor_id: vendedorId,
      marcou_vendido: false,
    }, { onConflict: "user_id,veiculo_id" });
    if (error) throw new Error(error.message);

    if (vendedorId) {
      const vendedores = await loadVendedores(sb, userId);
      const gerente = vendedores.find((v) =>
        (v as GestaoVendedorRow & { is_gerente?: boolean }).is_gerente
      );
      const [{ data: compra }, { data: despesas }] = await Promise.all([
        client.from("veiculo_compra").select("valor_compra, data_compra")
          .eq("user_id", userId).eq("veiculo_id", veiculoId).maybeSingle(),
        client.from("veiculo_despesas").select("valor, categoria, origem_lancamento")
          .eq("user_id", userId).eq("veiculo_id", veiculoId).is("deleted_at", null),
      ]);
      const dList = (despesas ?? []).map((d: Record<string, unknown>) => ({
        valor: Number(d.valor),
        categoria: String(d.categoria ?? ""),
        origem_lancamento: String(d.origem_lancamento ?? ""),
      }));
      const compraVal = compra ? Number(compra.valor_compra) : null;
      const valorVenda = Number(draft.valor);
      const lucroLiquido = lucroLiquidoAntesComissaoAuto({
        valorCompra: compraVal,
        valorVenda,
        despesas: dList,
      });
      const margemPct = margemPctAntesComissaoAuto(lucroLiquido, valorVenda);
      const regraVendedor = await loadRegraComissao(sb, userId, vendedorId);
      const regraGerente = gerente ? await loadRegraComissao(sb, userId, gerente.id) : null;
      const sync = await applyGestaoComissaoSync(client, {
        userId,
        veiculoId,
        vendedorId,
        vendedorNome: vendedorNome ?? "Vendedor",
        gerenteId: gerente?.id ?? null,
        valorVenda,
        lucroLiquido,
        margemPct,
        regraVendedor,
        regraGerente,
        valorComissaoOverride: draft.comissao_override != null
          ? Number(draft.comissao_override)
          : null,
        dataDespesa: today,
      });
      await recordWhatsappLancamento(sb, userId, fromNumber, "venda", veiculoId, "veiculo_venda");
      return `Venda registrada. Comissão ${formatBrl(sync.comissaoTotal)} lançada no carro.`;
    }

    await estornarComissaoAuto(client, userId, veiculoId);
    await recordWhatsappLancamento(sb, userId, fromNumber, "venda", veiculoId, "veiculo_venda");
    return "Venda registrada.";
  }

  throw new Error("acao_invalida");
}

async function finalizeNfeEmitConfirm(
  sb: unknown,
  userId: string,
  veiculo: GestaoVeiculoRow,
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>,
  agentState: Record<string, unknown>,
): Promise<{ reply: string }> {
  const client = sb as GestaoDb;
  const auth = await loadFocusTokenForUser(client, userId);
  if (!auth) return { reply: "Conecte a Focus NFe em Integrações." };
  const config = await loadNfeConfig(client, userId);
  if (!config) return { reply: "Configure os dados fiscais da loja no painel." };

  const tipo = await inferNfeTipoOperacao(client, userId, veiculo.id, null);
  const veiculoNfe = await loadVeiculoNfeFields(client, userId, veiculo.id);
  if (!veiculoNfe) return { reply: "Veículo não encontrado." };

  const tomadorPartial = await loadTomadorForNfe(client, userId, veiculo.id, tipo);
  const missing = tomadorMissingFields(tomadorPartial);
  if (missing.length) {
    return { reply: buildNfeEmitBlockedMessage(missing) };
  }

  let valorTotal: number;
  try {
    valorTotal = await resolveNfeValorTotal(client, userId, veiculo.id, tipo, null);
  } catch (e) {
    return { reply: (e as Error).message };
  }

  const op = operacaoFromConfig(config, tipo);
  const preview = buildJarvisNfePreview(veiculo, {
    tipo,
    valor: valorTotal,
    tomadorNome: String(tomadorPartial.nome ?? ""),
    cfop: op.cfop,
    natureza: op.natureza_operacao,
    ambiente: auth.ambiente,
  });

  const confirmPending: PendingGestaoConfirm = {
    phase: "confirm",
    action: "nfe_emit",
    draft: {
      veiculo_id: veiculo.id,
      tipo_operacao: tipo,
      valor_total: valorTotal,
      tomador: tomadorPartial,
      veiculo_nfe: veiculoNfe,
      preview_resumo: preview,
    },
    expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
  };
  await saveAgentStatePatch({ pending_gestao_confirm: confirmPending }, agentState);
  return { reply: buildConfirmMessage("nfe_emit", veiculo, confirmPending.draft) };
}

async function beginNfeEmitInboundFlow(
  sb: unknown,
  userId: string,
  vehicleHint: string,
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>,
  agentState: Record<string, unknown>,
): Promise<{ reply: string }> {
  const hint = vehicleHint?.trim();
  if (!hint) return { reply: "Informe o veículo, ex.: emite a nota do X6." };

  const vehicles = await loadVehicles(sb, userId);
  const matches = rankGestaoVeiculoMatches(hint, vehicles);
  if (!matches.length) return { reply: "Veículo não encontrado." };

  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((v, i) => ({
      n: i + 1,
      veiculo_id: v.id,
      label: formatGestaoVeiculoLabel(v),
    }));
    const pendingDis: PendingGestaoConfirm = {
      phase: "disambiguation",
      action: "nfe_emit",
      draft: {},
      expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
      options,
    };
    await saveAgentStatePatch({ pending_gestao_confirm: pendingDis }, agentState);
    const lines = options.map((o) => `${o.n}. ${o.label}`).join("\n");
    return { reply: `Qual veículo?\n${lines}\nResponda com o número.` };
  }

  return finalizeNfeEmitConfirm(sb, userId, matches[0], saveAgentStatePatch, agentState);
}

async function prepareDesfazer(
  sb: unknown,
  userId: string,
  fromNumber: string,
): Promise<{ reply: string; pending: PendingGestaoConfirm } | { reply: string }> {
  const mask = maskGestaoPhone(fromNumber);
  const cutoff = new Date(Date.now() - GESTAO_DESFAZER_TTL_MS).toISOString();
  const client = sb as GestaoDb;
  const { data: last } = await client.from("gestao_lancamentos_whatsapp")
    .select("id, tipo, referencia_id, referencia_tabela, created_at")
    .eq("user_id", userId).eq("telefone_mascarado", mask).gte("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!last) {
    return { reply: "Não encontrei lançamento recente seu para desfazer (24h)." };
  }
  const pending: PendingGestaoConfirm = {
    phase: "desfazer_confirm",
    action: "desfazer",
    draft: {
      lancamento_id: last.id,
      tipo: last.tipo,
      referencia_id: last.referencia_id,
      referencia_tabela: last.referencia_tabela,
    },
    expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
  };
  return {
    reply:
      `Desfazer último lançamento (${last.tipo})?\nResponda SIM ou NÃO.`,
    pending,
  };
}

async function executeDesfazer(sb: unknown, userId: string, draft: Record<string, unknown>): Promise<string> {
  const tabela = String(draft.referencia_tabela ?? "");
  const refId = draft.referencia_id;
  const client = sb as GestaoDb;
  if (tabela === "veiculo_despesas" && refId) {
    const { error } = await client.from("veiculo_despesas").update({
      deleted_at: new Date().toISOString(),
      deleted_by: "whatsapp_desfazer",
    }).eq("id", String(refId)).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return "Último lançamento desfeito.";
  }
  if (tabela === "veiculo_compra" && refId) {
    const { error } = await client.from("veiculo_compra").delete().eq("user_id", userId).eq(
      "veiculo_id",
      String(refId),
    );
    if (error) throw new Error(error.message);
    return "Compra removida.";
  }
  if (tabela === "veiculo_venda" && refId) {
    await estornarComissaoAuto(client, userId, String(refId));
    const { error } = await client.from("veiculo_venda").delete().eq("user_id", userId).eq(
      "veiculo_id",
      String(refId),
    );
    if (error) throw new Error(error.message);
    return "Venda removida.";
  }
  return "Não foi possível desfazer esse lançamento.";
}

export async function tryProcessGestaoLucroInbound(input: {
  sb: unknown;
  userId: string;
  fromNumber: string;
  userText: string;
  hasInboundMedia: boolean;
  auth: GestaoAuthContext;
  agentState: Record<string, unknown>;
  saveAgentStatePatch: (
    patch: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => Promise<boolean>;
}): Promise<{ handled: boolean; reply?: string; clearPending?: boolean }> {
  if (input.hasInboundMedia) return { handled: false };
  if (!isGestaoAuthorizedPhone(input.fromNumber, input.auth)) return { handled: false };

  const gate = await loadTenantVehicleStockGate(
    input.sb as Parameters<typeof loadTenantVehicleStockGate>[0],
    input.userId,
  );
  if (!gate.usesVehicleStock) return { handled: false };

  const text = (input.userText || "").trim();
  if (!text) return { handled: false };

  const pending = input.agentState.pending_gestao_confirm as PendingGestaoConfirm | undefined;

  if (pending && !pendingActive(pending)) {
    await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
    input.agentState.pending_gestao_confirm = null;
  }

  const activePending = pendingActive(pending) ? pending : null;

  if (activePending) {
    if (isGestaoNegative(text)) {
      await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
      return { handled: true, reply: "Ok, cancelado." };
    }

    if (activePending.phase === "disambiguation") {
      const pick = parseGestaoDisambiguationPick(text);
      if (pick != null) {
        const opt = activePending.options?.find((o) => o.n === pick);
        if (!opt) {
          if (!activePending.disambiguation_warned) {
            const retried: PendingGestaoConfirm = {
              ...activePending,
              disambiguation_warned: true,
              expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
            };
            await input.saveAgentStatePatch({ pending_gestao_confirm: retried }, input.agentState);
            const lines = activePending.options?.map((o) => `${o.n}. ${o.label}`).join("\n") ?? "";
            return {
              handled: true,
              reply: `Número inválido. Escolha:\n${lines}\nResponda com o número.`,
            };
          }
          await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
          return { handled: false, clearPending: true };
        }
        const vehicles = await loadVehicles(input.sb, input.userId);
        const veiculo = vehicles.find((v) => v.id === opt.veiculo_id);
        if (!veiculo) {
          await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
          return { handled: true, reply: "Veículo não encontrado." };
        }
        if (activePending.action === "nfe_emit") {
          const fin = await finalizeNfeEmitConfirm(
            input.sb,
            input.userId,
            veiculo,
            input.saveAgentStatePatch,
            input.agentState,
          );
          return { handled: true, reply: fin.reply };
        }
        let draft: Record<string, unknown> = { ...activePending.draft, veiculo_id: veiculo.id };
        if (activePending.action === "venda") {
          draft = await enrichVendaDraft(input.sb, input.userId, veiculo.id, draft);
        }
        const confirmPending: PendingGestaoConfirm = {
          phase: "confirm",
          action: activePending.action,
          draft,
          expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
        };
        await input.saveAgentStatePatch({ pending_gestao_confirm: confirmPending }, input.agentState);
        return {
          handled: true,
          reply: buildConfirmMessage(activePending.action, veiculo, confirmPending.draft),
        };
      }
      await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
      return { handled: false, clearPending: true };
    }

    if (
      activePending.phase === "confirm" &&
      activePending.action === "despesa" &&
      !isGestaoAffirmative(text) &&
      !isGestaoNegative(text)
    ) {
      const corrected = resolveGestaoCategoriaFromUserReply(text);
      if (corrected) {
        const confirmPending: PendingGestaoConfirm = {
          ...activePending,
          draft: { ...activePending.draft, categoria: corrected },
          expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
        };
        await input.saveAgentStatePatch(
          { pending_gestao_confirm: confirmPending },
          input.agentState,
        );
        const veiculoId = String(confirmPending.draft.veiculo_id ?? "");
        const vehicles = await loadVehicles(input.sb, input.userId);
        const veiculo = vehicles.find((v) => v.id === veiculoId);
        if (veiculo) {
          return {
            handled: true,
            reply: buildConfirmMessage("despesa", veiculo, confirmPending.draft),
          };
        }
      }
    }

    if (isGestaoAffirmative(text)) {
      if (activePending.phase === "desfazer_confirm") {
        const msg = await executeDesfazer(input.sb, input.userId, activePending.draft);
        await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
        return { handled: true, reply: msg };
      }
      if (activePending.phase === "confirm") {
        const veiculoId = String(activePending.draft.veiculo_id ?? "");
        const msg = await persistDraft(
          input.sb,
          input.userId,
          input.fromNumber,
          activePending.action,
          veiculoId,
          activePending.draft,
        );
        await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
        return { handled: true, reply: msg };
      }
    }

    await input.saveAgentStatePatch({ pending_gestao_confirm: null }, input.agentState);
    return { handled: false, clearPending: true };
  }

  const intent = classifyGestaoIntent(text);
  if (intent.kind === "none") return { handled: false };

  if (intent.kind === "lucro_mes") {
    const reply = await fetchLucroMes(input.sb, input.userId);
    return { handled: true, reply };
  }

  const competencia = competenciaFromDate();
  const today = hojeSaoPaulo();

  if (intent.kind === "contas_amanha") {
    const contas = await loadContasInbound(input.sb, input.userId);
    return { handled: true, reply: buildContasVencemAmanhaReply(contas, today) };
  }
  if (intent.kind === "contas_semana") {
    const contas = await loadContasInbound(input.sb, input.userId);
    return { handled: true, reply: buildContasSemanaReply(contas, today) };
  }
  if (intent.kind === "a_receber") {
    const contas = await loadContasInbound(input.sb, input.userId);
    return { handled: true, reply: buildAReceberReply(contas) };
  }
  if (intent.kind === "lucro_loja_mes") {
    const contas = await loadContasInbound(input.sb, input.userId);
    const vendas = await loadVendasDreMes(input.sb, input.userId, competencia);
    const ops = contasToDreOperacionalRows(contas.map((c) => ({
      tipo: c.tipo,
      categoria_operacional: c.categoria,
      valor: c.valor,
      vencimento: c.vencimento,
      pago_em: c.pago_em,
    })));
    return {
      handled: true,
      reply: buildLucroLojaMesReply(competencia, vendas, ops),
    };
  }
  if (intent.kind === "pacote_contador") {
    const site = Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "";
    const { appUrl } = await mintGestaoContadorLink(input.sb as never, input.userId, competencia, site);
    return { handled: true, reply: buildContadorLinkReply(appUrl, competencia) };
  }
  if (intent.kind === "conciliacao_pendente") {
    const client = input.sb as GestaoDb;
    const { data } = await client.from("gestao_extrato_transacao").select("valor, status")
      .eq("user_id", input.userId)
      .in("status", ["pendente", "confirmar"]);
    const rows = data ?? [];
    const qtd = rows.length;
    const valor = rows.reduce((a: number, r: { valor: number }) => a + Number(r.valor), 0);
    return { handled: true, reply: buildConciliacaoPendenteReply(qtd, valor) };
  }

  if (intent.kind === "contratos_pendentes") {
    const client = input.sb as GestaoDb;
    const { count } = await client.from("gestao_contrato").select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .eq("status", "pendente_assinatura");
    return { handled: true, reply: buildContratosPendentesReply(count ?? 0) };
  }

  if (intent.kind === "contrato_status") {
    const client = input.sb as GestaoDb;
    const hint = intent.vehicleHint?.trim();
    if (!hint) {
      return { handled: true, reply: "Informe o veículo, ex.: status do contrato do X6." };
    }
    const { data: veiculos } = await client.from("veiculos_estoque").select(GESTAO_VEHICLE_SELECT)
      .eq("user_id", input.userId);
    const ranked = rankGestaoVeiculoMatches(hint, veiculos ?? []);
    const v = ranked[0];
    if (!v) return { handled: true, reply: "Veículo não encontrado." };
    const { data: contrato } = await client.from("gestao_contrato").select("status, zapsign_sign_url")
      .eq("user_id", input.userId)
      .eq("veiculo_id", v.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!contrato) {
      return { handled: true, reply: `Nenhum contrato para ${formatGestaoVeiculoLabel(v)}.` };
    }
    return {
      handled: true,
      reply: buildContratoStatusReply({
        veiculoLabel: formatGestaoVeiculoLabel(v),
        status: String(contrato.status),
        signUrl: contrato.zapsign_sign_url,
      }),
    };
  }

  if (intent.kind === "notas_mes") {
    const client = input.sb as GestaoDb;
    const { start, end } = intervaloCompetencia(competencia);
    const { data } = await client.from("gestao_nfe").select("status, authorized_at, created_at")
      .eq("user_id", input.userId);
    const rows = (data ?? []).filter((r: { authorized_at: string | null; created_at: string }) => {
      const d = (r.authorized_at ?? r.created_at).slice(0, 10);
      return d >= start && d <= end;
    });
    const autorizadas = rows.filter((r: { status: string }) => r.status === "autorizada").length;
    return {
      handled: true,
      reply: buildNotasMesReply({ competencia, total: rows.length, autorizadas }),
    };
  }

  if (intent.kind === "nfe_status") {
    const client = input.sb as GestaoDb;
    const hint = intent.vehicleHint?.trim();
    if (!hint) {
      return { handled: true, reply: "Informe o veículo, ex.: status da nota do X6." };
    }
    const { data: veiculos } = await client.from("veiculos_estoque").select(GESTAO_VEHICLE_SELECT)
      .eq("user_id", input.userId);
    const ranked = rankGestaoVeiculoMatches(hint, veiculos ?? []);
    const v = ranked[0];
    if (!v) return { handled: true, reply: "Veículo não encontrado." };
    const { data: nfe } = await client.from("gestao_nfe").select("status, numero, serie")
      .eq("user_id", input.userId)
      .eq("veiculo_id", v.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!nfe) {
      return { handled: true, reply: `Nenhuma NF-e para ${formatGestaoVeiculoLabel(v)}.` };
    }
    return {
      handled: true,
      reply: buildNfeStatusReply({
        veiculoLabel: formatGestaoVeiculoLabel(v),
        status: String(nfe.status),
        numero: nfe.numero != null ? Number(nfe.numero) : null,
        serie: nfe.serie != null ? Number(nfe.serie) : null,
      }),
    };
  }

  if (intent.kind === "nfe_emit") {
    const flow = await beginNfeEmitInboundFlow(
      input.sb,
      input.userId,
      intent.vehicleHint,
      input.saveAgentStatePatch,
      input.agentState,
    );
    return { handled: true, reply: flow.reply };
  }

  if (intent.kind === "revogar_link_contador") {
    const client = input.sb as GestaoDb;
    const now = new Date().toISOString();
    const { data: active } = await client.from("gestao_contador_token").select("id")
      .eq("user_id", input.userId)
      .is("revogado_em", null)
      .gt("expires_at", now);
    let n = 0;
    for (const row of active ?? []) {
      await client.from("gestao_contador_token").update({ revogado_em: now })
        .eq("id", String(row.id));
      n += 1;
    }
    return { handled: true, reply: buildRevogarContadorLinkReply(n) };
  }
  if (intent.kind === "ranking_vendedores") {
    const vendedores = await loadVendedores(input.sb, input.userId);
    const comissao = await loadComissaoMesMap(input.sb, input.userId, competencia);
    const reply = await buildGestaoRankingReply(
      input.sb as never,
      input.userId,
      comissao,
      vendedores,
      competencia,
    );
    return { handled: true, reply };
  }
  if (intent.kind === "comissao_mes") {
    const vendedores = await loadVendedores(input.sb, input.userId);
    const comissao = await loadComissaoMesMap(input.sb, input.userId, competencia);
    return { handled: true, reply: buildComissaoMesReply(comissao, vendedores, competencia) };
  }
  if (intent.kind === "vendedor_mes") {
    const vendedores = await loadVendedores(input.sb, input.userId);
    const reply = await buildGestaoVendedorMesReply(
      input.sb as never,
      input.userId,
      intent.vendedorHint,
      vendedores,
      competencia,
    );
    return { handled: true, reply };
  }
  if (intent.kind === "meta_bateu") {
    return {
      handled: true,
      reply: `Metas ${competencia}: configure metas em Gestão → Equipe no painel para acompanhar aqui.`,
    };
  }

  if (intent.kind === "piores_negocios_mes") {
    const reply = await fetchPioresNegociosMes(input.sb, input.userId);
    return { handled: true, reply };
  }

  const vehicles = await loadVehicles(input.sb, input.userId);
  const matches = rankGestaoVeiculoMatches(intent.vehicleHint, vehicles);

  if (intent.kind === "venda_raiox") {
    if (!matches[0]) return { handled: true, reply: "Não achei esse veículo no estoque." };
    const reply = await fetchVendaRaioxVeiculo(input.sb, input.userId, matches[0].id, matches[0]);
    return { handled: true, reply };
  }

  if (intent.kind === "lucro_veiculo") {
    if (!matches[0]) return { handled: true, reply: "Não achei esse veículo no estoque." };
    const reply = await fetchLucroVeiculo(input.sb, input.userId, matches[0].id, matches[0]);
    return { handled: true, reply };
  }

  if (intent.kind === "despesas_veiculo") {
    if (!matches[0]) return { handled: true, reply: "Não achei esse veículo no estoque." };
    const reply = await fetchDespesasVeiculo(input.sb, input.userId, matches[0].id, matches[0]);
    return { handled: true, reply };
  }

  if (intent.kind === "desfazer") {
    const prep = await prepareDesfazer(input.sb, input.userId, input.fromNumber);
    if ("pending" in prep) {
      await input.saveAgentStatePatch({ pending_gestao_confirm: prep.pending }, input.agentState);
    }
    return { handled: true, reply: prep.reply };
  }

  if (!matches.length) {
    return { handled: true, reply: "Qual veículo? Informe modelo ou placa." };
  }

  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((v, i) => ({
      n: i + 1,
      veiculo_id: v.id,
      label: formatGestaoVeiculoLabel(v),
    }));
    const pendingDis: PendingGestaoConfirm = {
      phase: "disambiguation",
      action: intent.kind,
      draft: {
        valor: intent.valor,
        categoria: intent.categoria,
        consignacao: intent.consignacao,
        vendedor_hint: intent.vendedorHint,
      },
      expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
      options,
    };
    await input.saveAgentStatePatch({ pending_gestao_confirm: pendingDis }, input.agentState);
    const lines = options.map((o) => `${o.n}. ${o.label}`).join("\n");
    return { handled: true, reply: `Qual veículo?\n${lines}\nResponda com o número.` };
  }

  const veiculo = matches[0];
  let draft: Record<string, unknown> = {
    valor: intent.valor,
    categoria: intent.categoria,
    consignacao: intent.consignacao,
    veiculo_id: veiculo.id,
    vendedor_hint: intent.vendedorHint,
  };
  if (intent.kind === "venda") {
    draft = await enrichVendaDraft(input.sb, input.userId, veiculo.id, draft);
  }
  const confirmPending: PendingGestaoConfirm = {
    phase: "confirm",
    action: intent.kind,
    draft,
    expires_at: new Date(Date.now() + GESTAO_PENDING_TTL_MS).toISOString(),
  };
  await input.saveAgentStatePatch({ pending_gestao_confirm: confirmPending }, input.agentState);
  return {
    handled: true,
    reply: buildConfirmMessage(intent.kind, veiculo, draft),
  };
}

export { loadGestaoAuthContext };
