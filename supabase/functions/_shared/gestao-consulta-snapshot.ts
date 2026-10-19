import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcGestaoLucro } from "./gestao-lucro-calc.ts";
import { calcDreMes, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import { buildRankingVendedores, type VendaEquipeLine } from "./gestao-equipe-stats.ts";
import {
  calcMetaProgresso,
  competenciaFromDate,
  type GestaoMetaConfigJson,
} from "./gestao-meta-calc.ts";
import { gestaoDespesaCategoriaLabel } from "./gestao-categoria-pt.ts";
import { formatGestaoVeiculoLabel, type GestaoVeiculoRow } from "./gestao-veiculo-match.ts";
import {
  addDiasYmd,
  GESTAO_TZ,
  formatYmdSaoPaulo,
  hojeSaoPaulo,
  intervaloCompetencia,
  intervaloMesAtualSaoPaulo,
} from "./gestao-date-br.ts";
import { syncRecorrenciaLancamentosDb } from "./gestao-recorrencia-db-sync.ts";
import { mesNomePt } from "./gestao-posicao-loja.ts";
import { dreMargensPct } from "./gestao-dre-whatsapp.ts";

export type GestaoConsultaPeriodoInput =
  | "hoje"
  | "ontem"
  | "semana"
  | "mes"
  | "mes_anterior"
  | "ano"
  | { inicio: string; fim: string };

export type GestaoConsultaFoco =
  | "vendas"
  | "estoque"
  | "despesas"
  | "contas"
  | "conciliacao"
  | "dre"
  | "meta"
  | "vendedores"
  | "leads"
  | "conversas"
  | "notas"
  | "tudo";

export type GestaoConsultaSnapshot = Record<string, unknown>;

type Db = SupabaseClient;

function weekdayIndexSaoPaulo(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00-03:00`);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: GESTAO_TZ,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? 0;
}

export function resolveGestaoConsultaPeriodo(
  periodo: GestaoConsultaPeriodoInput = "mes",
  now = new Date(),
): { inicio: string; fim: string; competencia: string; label: string } {
  const today = formatYmdSaoPaulo(now);
  const [yStr] = today.split("-");
  const year = Number(yStr);

  if (typeof periodo === "object" && periodo.inicio && periodo.fim) {
    const competencia = periodo.inicio.slice(0, 7);
    return {
      inicio: periodo.inicio.slice(0, 10),
      fim: periodo.fim.slice(0, 10),
      competencia,
      label: `${periodo.inicio} a ${periodo.fim}`,
    };
  }

  const p = periodo ?? "mes";
  if (p === "hoje") {
    return { inicio: today, fim: today, competencia: today.slice(0, 7), label: "hoje" };
  }
  if (p === "ontem") {
    const ontem = addDiasYmd(today, -1);
    return { inicio: ontem, fim: ontem, competencia: ontem.slice(0, 7), label: "ontem" };
  }
  if (p === "semana") {
    const dow = weekdayIndexSaoPaulo(today);
    const sinceMonday = (dow + 6) % 7;
    const inicio = addDiasYmd(today, -sinceMonday);
    return { inicio, fim: today, competencia: today.slice(0, 7), label: "semana (seg–hoje)" };
  }
  if (p === "mes_anterior") {
    const [y, m] = today.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const { start, end } = intervaloCompetencia(prev);
    return { inicio: start, fim: end, competencia: prev, label: mesNomePt(prev) };
  }
  if (p === "ano") {
    return {
      inicio: `${year}-01-01`,
      fim: today,
      competencia: today.slice(0, 7),
      label: `ano ${year}`,
    };
  }
  const { start, end } = intervaloMesAtualSaoPaulo(now);
  const competencia = start.slice(0, 7);
  return { inicio: start, fim: end, competencia, label: mesNomePt(competencia) };
}

export function parseGestaoConsultaPeriodoArg(raw: unknown): GestaoConsultaPeriodoInput {
  const s = String(raw ?? "mes").trim().toLowerCase();
  if (s === "hoje" || s === "ontem" || s === "semana" || s === "mes" || s === "mes_anterior" || s === "ano") {
    return s;
  }
  return "mes";
}

export function parseGestaoConsultaFocoArg(raw: unknown): GestaoConsultaFoco {
  const s = String(raw ?? "tudo").trim().toLowerCase();
  const allowed: GestaoConsultaFoco[] = [
    "vendas", "estoque", "despesas", "contas", "conciliacao", "dre", "meta",
    "vendedores", "leads", "conversas", "notas", "tudo",
  ];
  return (allowed.includes(s as GestaoConsultaFoco) ? s : "tudo") as GestaoConsultaFoco;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function filterSnapshotByFoco(
  snap: GestaoConsultaSnapshot,
  foco: GestaoConsultaFoco,
): GestaoConsultaSnapshot {
  if (foco === "tudo") return snap;
  const keys: Record<GestaoConsultaFoco, string[]> = {
    vendas: ["periodo", "vendas"],
    estoque: ["periodo", "estoque"],
    despesas: ["periodo", "despesas"],
    contas: ["periodo", "contas"],
    conciliacao: ["periodo", "conciliacao"],
    dre: ["periodo", "dre"],
    meta: ["periodo", "meta"],
    vendedores: ["periodo", "vendedores"],
    leads: ["periodo", "leads"],
    conversas: ["periodo", "conversas"],
    notas: ["periodo", "notas_fiscais"],
    tudo: [],
  };
  const keep = new Set(keys[foco]);
  const out: GestaoConsultaSnapshot = {};
  for (const k of keep) {
    if (snap[k] !== undefined) out[k] = snap[k];
  }
  return out;
}

export async function loadGestaoConsultaSnapshot(
  sb: Db,
  storeUserId: string,
  periodo: GestaoConsultaPeriodoInput = "mes",
  now = new Date(),
): Promise<GestaoConsultaSnapshot> {
  await syncRecorrenciaLancamentosDb(sb as never, storeUserId);
  const range = resolveGestaoConsultaPeriodo(periodo, now);
  const { inicio, fim, competencia, label } = range;
  const today = formatYmdSaoPaulo(now);
  const in7 = addDiasYmd(today, 7);

  const snap: GestaoConsultaSnapshot = {
    periodo: { inicio, fim, competencia, label },
  };

  const { data: vendedoresRaw } = await sb.from("gestao_vendedores").select("id, nome, ativo")
    .eq("user_id", storeUserId).eq("ativo", true);
  const nomeById = new Map(
    (vendedoresRaw ?? []).map((v: { id: string; nome: string }) => [v.id, v.nome]),
  );

  const { data: vendasRaw } = await sb.from("veiculo_venda").select(
    "veiculo_id, valor_venda, data_venda, vendedor_id",
  ).eq("user_id", storeUserId).gte("data_venda", inicio).lte("data_venda", fim)
    .order("data_venda", { ascending: false }).limit(30);

  const vendasLista: Record<string, unknown>[] = [];
  let fatVendas = 0;
  let lucroVendas = 0;
  for (const row of vendasRaw ?? []) {
    const vid = String(row.veiculo_id);
    fatVendas += Number(row.valor_venda);
    const [{ data: compra }, { data: despesas }, { data: veiculo }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).is("deleted_at", null),
      sb.from("veiculos_estoque").select("marca, modelo, versao, status, preco")
        .eq("user_id", storeUserId).eq("id", vid).maybeSingle(),
    ]);
    const lucro = calcGestaoLucro({
      valorCompra: compra?.valor_compra != null ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
        valor: Number(d.valor),
        categoria: d.categoria,
      })),
      valorVenda: Number(row.valor_venda),
      precoAnunciado: veiculo?.preco != null ? Number(veiculo.preco) : null,
      dataCompra: null,
      dataVenda: String(row.data_venda),
      statusVeiculo: String(veiculo?.status ?? "vendido"),
    });
    lucroVendas += lucro.lucroLiquido ?? 0;
    const vendedorId = row.vendedor_id ? String(row.vendedor_id) : null;
    let comissao = 0;
    if (vendedorId) {
      const { data: auto } = await sb.from("gestao_comissao_auto").select("valor")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle();
      comissao = Number(auto?.valor ?? 0);
    }
    vendasLista.push({
      data: String(row.data_venda),
      veiculo: veiculo ? formatGestaoVeiculoLabel(veiculo as GestaoVeiculoRow) : vid.slice(0, 8),
      valor_venda: roundMoney(Number(row.valor_venda)),
      vendedor: vendedorId ? (nomeById.get(vendedorId) ?? "Vendedor") : null,
      lucro: roundMoney(lucro.lucroLiquido ?? 0),
      comissao: roundMoney(comissao),
    });
  }
  snap.vendas = {
    lista: vendasLista,
    totais: {
      qtd: vendasLista.length,
      faturamento: roundMoney(fatVendas),
      lucro: roundMoney(lucroVendas),
    },
  };

  const { data: veiculos } = await sb.from("veiculos_estoque").select(
    "id, marca, modelo, versao, status, preco, created_at",
  ).eq("user_id", storeUserId);
  const estoqueLista: Record<string, unknown>[] = [];
  let estAnunciado = 0;
  let estLucroProj = 0;
  const nowMs = now.getTime();
  for (const v of (veiculos ?? []).slice(0, 80)) {
    if (String(v.status) === "vendido") continue;
    if (estoqueLista.length >= 40) break;
    const vid = String(v.id);
    const preco = v.preco != null ? Number(v.preco) : 0;
    estAnunciado += preco;
    const created = Date.parse(String(v.created_at ?? ""));
    const dias = Number.isFinite(created) ? Math.floor((nowMs - created) / 86400000) : 0;
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const custoCompra = compra?.valor_compra != null ? Number(compra.valor_compra) : 0;
    const somaDesp = (despesas ?? []).reduce(
      (a: number, d: { valor: number }) => a + Number(d.valor),
      0,
    );
    const lucro = calcGestaoLucro({
      valorCompra: compra?.valor_compra != null ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number }) => ({
        valor: Number(d.valor),
        categoria: "",
      })),
      valorVenda: null,
      precoAnunciado: preco > 0 ? preco : null,
      dataCompra: null,
      dataVenda: null,
      statusVeiculo: String(v.status),
    });
    const lp = lucro.lucroProjetado ?? 0;
    estLucroProj += lp;
    estoqueLista.push({
      veiculo: formatGestaoVeiculoLabel(v as GestaoVeiculoRow),
      preco_anunciado: roundMoney(preco),
      dias_estoque: dias,
      custo_total: roundMoney(custoCompra + somaDesp),
      despesas_soma: roundMoney(somaDesp),
      lucro_projetado: roundMoney(lp),
    });
  }
  snap.estoque = {
    lista: estoqueLista,
    totais: {
      qtd: estoqueLista.length,
      valor_anunciado: roundMoney(estAnunciado),
      lucro_projetado: roundMoney(estLucroProj),
    },
  };

  const { data: despesasPeriodo } = await sb.from("veiculo_despesas").select(
    "valor, categoria, data, veiculo_id",
  ).eq("user_id", storeUserId).gte("data", inicio).lte("data", fim).is("deleted_at", null)
    .order("data", { ascending: false });

  const catMap = new Map<string, number>();
  for (const d of despesasPeriodo ?? []) {
    const cat = gestaoDespesaCategoriaLabel(String(d.categoria ?? ""));
    catMap.set(cat, (catMap.get(cat) ?? 0) + Number(d.valor));
  }
  const ultimasDespesas: Record<string, unknown>[] = [];
  for (const d of (despesasPeriodo ?? []).slice(0, 20)) {
    const vid = String(d.veiculo_id);
    const { data: veic } = await sb.from("veiculos_estoque").select("marca, modelo, versao")
      .eq("user_id", storeUserId).eq("id", vid).maybeSingle();
    ultimasDespesas.push({
      data: String(d.data),
      veiculo: veic ? formatGestaoVeiculoLabel(veic as GestaoVeiculoRow) : vid.slice(0, 8),
      categoria: gestaoDespesaCategoriaLabel(String(d.categoria ?? "")),
      valor: roundMoney(Number(d.valor)),
    });
  }
  snap.despesas = {
    por_categoria: [...catMap.entries()].map(([categoria, valor]) => ({ categoria, valor: roundMoney(valor) })),
    ultimas: ultimasDespesas,
    total: roundMoney([...(despesasPeriodo ?? [])].reduce((a, d) => a + Number(d.valor), 0)),
  };

  const { data: contasRaw } = await sb.from("gestao_conta_lancamento").select(
    "tipo, valor, vencimento, pago_em, recebido_em, categoria_operacional",
  ).eq("user_id", storeUserId).is("deleted_at", null);

  type ContaRow = {
    tipo: string;
    valor: number;
    vencimento: string;
    pago_em: string | null;
    recebido_em: string | null;
    categoria_operacional: string | null;
  };
  const contas = (contasRaw ?? []) as ContaRow[];
  const bucket = (tipo: string, filter: (c: ContaRow) => boolean, max = 20) =>
    contas.filter((c) => c.tipo === tipo && filter(c)).slice(0, max).map((c) => ({
      valor: roundMoney(Number(c.valor)),
      vencimento: String(c.vencimento ?? "").slice(0, 10),
      categoria: String(c.categoria_operacional ?? ""),
    }));

  snap.contas = {
    pagar_vencidas: bucket("pagar", (c) => !c.pago_em && String(c.vencimento).slice(0, 10) < today),
    pagar_hoje: bucket("pagar", (c) => !c.pago_em && String(c.vencimento).slice(0, 10) === today),
    pagar_proximos_7_dias: bucket("pagar", (c) => {
      const v = String(c.vencimento).slice(0, 10);
      return !c.pago_em && v > today && v <= in7;
    }),
    receber_vencidas: bucket("receber", (c) => !c.recebido_em && String(c.vencimento).slice(0, 10) < today),
    receber_hoje: bucket("receber", (c) => !c.recebido_em && String(c.vencimento).slice(0, 10) === today),
    receber_proximos_7_dias: bucket("receber", (c) => {
      const v = String(c.vencimento).slice(0, 10);
      return !c.recebido_em && v > today && v <= in7;
    }),
    pagas_no_periodo: bucket("pagar", (c) => {
      const p = c.pago_em ? String(c.pago_em).slice(0, 10) : "";
      return !!p && p >= inicio && p <= fim;
    }),
    recebidas_no_periodo: bucket("receber", (c) => {
      const r = c.recebido_em ? String(c.recebido_em).slice(0, 10) : "";
      return !!r && r >= inicio && r <= fim;
    }),
  };

  const { data: concRows } = await sb.from("gestao_extrato_transacao").select("valor, status, created_at")
    .eq("user_id", storeUserId).in("status", ["pendente", "confirmar"]);
  const concPend = (concRows ?? []) as { valor: number; created_at: string }[];
  const { data: lastConc } = await sb.from("gestao_extrato_transacao").select("created_at")
    .eq("user_id", storeUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  snap.conciliacao = {
    pendentes_qtd: concPend.length,
    pendentes_valor: roundMoney(concPend.reduce((a, r) => a + Number(r.valor), 0)),
    ultima_importacao: lastConc?.created_at ? String(lastConc.created_at).slice(0, 10) : null,
  };

  const dreComp = competencia;
  const { start: mesStart, end: mesEnd } = intervaloCompetencia(dreComp);
  const { data: vendasMes } = await sb.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", storeUserId).gte("data_venda", mesStart).lte("data_venda", mesEnd);
  const dreLines: GestaoVendaDreLine[] = [];
  for (const v of vendasMes ?? []) {
    const vid = String(v.veiculo_id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra").eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    dreLines.push({
      veiculoId: vid,
      dataVenda: String(v.data_venda),
      valorVenda: Number(v.valor_venda),
      valorCompra: compra?.valor_compra != null ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
        valor: Number(d.valor),
        categoria: String(d.categoria ?? ""),
      })),
    });
  }
  const ops = contasToDreOperacionalRows(contas.map((c) => ({
    tipo: c.tipo as "pagar" | "receber",
    categoria_operacional: String(c.categoria_operacional ?? ""),
    valor: Number(c.valor),
    vencimento: String(c.vencimento ?? ""),
    pago_em: c.pago_em ? String(c.pago_em) : null,
  })));
  const dre = calcDreMes(dreComp, dreLines, ops);
  const margens = dreMargensPct(dre);
  snap.dre = {
    competencia: dreComp,
    faturamento: roundMoney(dre.faturamento),
    lucro_carros: roundMoney(dre.lucroCarros),
    despesas_loja: roundMoney(dre.despesasOperacionais),
    lucro_liquido: roundMoney(dre.lucroLiquidoLoja),
    margem_bruta_pct: margens.margem_bruta_pct,
    margem_liquida_pct: margens.margem_liquida_pct,
  };

  const { data: metaRow } = await sb.from("gestao_meta_mensal").select("config_json")
    .eq("user_id", storeUserId).eq("competencia", dreComp).is("vendedor_id", null).maybeSingle();
  const metaCfg = metaRow?.config_json as GestaoMetaConfigJson | undefined;
  if (metaCfg) {
    const vendasEquipe: VendaEquipeLine[] = [];
    for (const row of vendasRaw ?? []) {
      vendasEquipe.push({
        veiculo_id: String(row.veiculo_id),
        valor_venda: Number(row.valor_venda),
        data_venda: String(row.data_venda),
        vendedor_id: row.vendedor_id ? String(row.vendedor_id) : null,
        lucro_liquido: null,
      });
    }
    let realizado = vendasEquipe.length;
    if (metaCfg.tipo === "faturamento") {
      realizado = vendasEquipe.reduce((a, v) => a + v.valor_venda, 0);
    } else if (metaCfg.tipo === "lucro") {
      realizado = dre.lucroCarros;
    }
    const prog = calcMetaProgresso(metaCfg, realizado, now);
    snap.meta = {
      alvo: metaCfg.metaValor,
      realizado: roundMoney(realizado),
      pct: roundMoney(prog.pctAtingido),
      projecao_pct: roundMoney(prog.projecaoPct),
    };
  } else {
    snap.meta = { alvo: null, realizado: null };
  }

  const comissaoMap = new Map<string, number>();
  const vendaIds = (vendasRaw ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (vendaIds.length) {
    const { data: autos } = await sb.from("gestao_comissao_auto").select("vendedor_id, valor")
      .eq("user_id", storeUserId).in("veiculo_id", vendaIds);
    for (const a of autos ?? []) {
      const vid = String(a.vendedor_id);
      comissaoMap.set(vid, (comissaoMap.get(vid) ?? 0) + Number(a.valor));
    }
  }
  const vendasEquipeMes: VendaEquipeLine[] = [];
  for (const row of vendasMes ?? []) {
    vendasEquipeMes.push({
      veiculo_id: String(row.veiculo_id),
      valor_venda: Number(row.valor_venda),
      data_venda: String(row.data_venda),
      vendedor_id: null,
      lucro_liquido: null,
    });
  }
  snap.vendedores = buildRankingVendedores(
    vendasEquipeMes,
    comissaoMap,
    nomeById,
    dreComp,
  ).slice(0, 15).map((r) => ({
    nome: r.nome,
    qtd: r.qtd,
    faturamento: roundMoney(r.faturamento),
    lucro: roundMoney(r.lucroGerado),
    comissao: roundMoney(r.comissao),
  }));

  const dayStart = `${inicio}T00:00:00-03:00`;
  const dayEnd = `${fim}T23:59:59-03:00`;
  const { data: leadsRows } = await sb.from("jarvis_leads").select("origem, notificado_em, created_at")
    .eq("user_id", storeUserId).gte("created_at", dayStart).lte("created_at", dayEnd);
  const origemMap = new Map<string, number>();
  let semResposta = 0;
  for (const l of leadsRows ?? []) {
    const o = String(l.origem ?? "outros");
    origemMap.set(o, (origemMap.get(o) ?? 0) + 1);
    if (!l.notificado_em) semResposta += 1;
  }
  snap.leads = {
    qtd: (leadsRows ?? []).length,
    por_origem: [...origemMap.entries()].map(([origem, qtd]) => ({ origem, qtd })),
    sem_resposta: semResposta,
  };

  const { data: msgs } = await sb.from("whatsapp_cloud_messages").select("conversation_id, sender")
    .eq("user_id", storeUserId).gte("created_at", dayStart).lte("created_at", dayEnd).limit(3000);
  const convSet = new Set<string>();
  for (const m of msgs ?? []) {
    if (String(m.sender ?? "") === "campanha") continue;
    convSet.add(String(m.conversation_id));
  }
  snap.conversas = { qtd: convSet.size };

  const { data: nfes } = await sb.from("gestao_nfe").select("status, authorized_at, created_at")
    .eq("user_id", storeUserId);
  const nfMes = (nfes ?? []).filter((n: { authorized_at: string | null; created_at: string | null }) => {
    const d = String(n.authorized_at ?? n.created_at ?? "").slice(0, 10);
    return d >= mesStart && d <= mesEnd;
  });
  const statusMap = new Map<string, number>();
  for (const n of nfMes) {
    const st = String(n.status ?? "desconhecido");
    statusMap.set(st, (statusMap.get(st) ?? 0) + 1);
  }
  snap.notas_fiscais = {
    competencia: dreComp,
    por_status: [...statusMap.entries()].map(([status, qtd]) => ({ status, qtd })),
  };

  return snap;
}

/** Garante que JSON de consulta não carrega campos de PII conhecidos. */
export function assertSnapshotSemPii(json: string): boolean {
  const banned = /\b(\+?\d{10,15}|[a-z0-9._%+-]+@[a-z0-9.-]+\.\w{2,}|telefone|cpf|cnpj)\b/i;
  return !banned.test(json);
}
