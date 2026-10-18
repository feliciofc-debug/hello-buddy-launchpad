import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcGestaoLucro } from "./gestao-lucro-calc.ts";
import { calcDreMes, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import {
  buildRankingVendedores,
  type RankingVendedor,
  type VendaEquipeLine,
} from "./gestao-equipe-stats.ts";
import {
  calcMetaProgresso,
  competenciaFromDate,
  type GestaoMetaConfigJson,
} from "./gestao-meta-calc.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { hojeSaoPaulo, intervaloCompetencia } from "./gestao-date-br.ts";
import { syncRecorrenciaLancamentosDb } from "./gestao-recorrencia-db-sync.ts";
import type { GestaoVendedorRow } from "./gestao-vendedor-match.ts";
import { matchGestaoVendedor } from "./gestao-vendedor-match.ts";

export type PosicaoLojaDb = SupabaseClient;

export type PosicaoLojaFacts = {
  geradoEm: string;
  competencia: string;
  mesLabel: string;
  storeUserId: string;
  lojaNomeCitada: string | null;
  mes: {
    qtdVendas: number;
    faturamento: number;
    lucroCarros: number;
    margemCarrosPct: number | null;
    lucroLiquido: number;
    metaSalva: boolean;
    metaRealizado: number | null;
    metaValor: number | null;
    metaPct: number | null;
    metaProjecaoPct: number | null;
  };
  vendedoresTop: RankingVendedor[];
  estoque: {
    qtd: number;
    valorAnunciado: number;
    lucroProjetado: number;
    parados90Qtd: number;
    parados90ValorAnunciado: number;
  };
  hoje: {
    despesasQtd: number;
    despesasValor: number;
    vendasQtd: number;
    leadsNovos: number | null;
    conversasAtendidas: number | null;
  };
  atencao: {
    contasVencidasQtd: number;
    contasVencidasValor: number;
    contas7DiasQtd: number;
    contas7DiasValor: number;
    custoCompraPendenteQtd: number;
    vendaRegistradaSemVendidoQtd: number;
    conciliacaoPendenteQtd: number;
  };
};

export function formatPosicaoMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const mi = value / 1_000_000;
    return `R$ ${mi.toFixed(2).replace(".", ",")} mi`;
  }
  if (abs >= 100_000) {
    const mil = Math.round(value / 1000);
    return `R$ ${mil.toLocaleString("pt-BR")} mil`;
  }
  return formatGestaoMoney(value);
}

function mesNomePt(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
}

function formatGeradoEm(agora: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}, ${get("hour")}:${get("minute")}`;
}

async function loadVendasDreMes(
  sb: PosicaoLojaDb,
  userId: string,
  competencia: string,
): Promise<GestaoVendaDreLine[]> {
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id, valor_venda, data_venda")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const lines: GestaoVendaDreLine[] = [];
  for (const v of vendas ?? []) {
    const vid = String(v.veiculo_id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra").eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    lines.push({
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
  return lines;
}

async function loadVendasEquipeComLucro(
  sb: PosicaoLojaDb,
  userId: string,
  competencia: string,
): Promise<VendaEquipeLine[]> {
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendasRaw } = await sb.from("veiculo_venda").select(
    "veiculo_id, valor_venda, data_venda, vendedor_id",
  ).eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);

  const out: VendaEquipeLine[] = [];
  for (const row of vendasRaw ?? []) {
    const vid = String(row.veiculo_id);
    const [{ data: compra }, { data: despesas }, { data: veiculo }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra, data_compra")
        .eq("user_id", userId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", userId).eq("veiculo_id", vid).is("deleted_at", null),
      sb.from("veiculos_estoque").select("status, preco")
        .eq("user_id", userId).eq("id", vid).maybeSingle(),
    ]);
    const lucro = calcGestaoLucro({
      valorCompra: compra?.valor_compra != null ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
        valor: Number(d.valor),
        categoria: d.categoria,
      })),
      valorVenda: Number(row.valor_venda),
      precoAnunciado: veiculo?.preco != null ? Number(veiculo.preco) : null,
      dataCompra: compra?.data_compra ? String(compra.data_compra) : null,
      dataVenda: String(row.data_venda),
      statusVeiculo: String(veiculo?.status ?? "vendido"),
    });
    out.push({
      veiculo_id: vid,
      valor_venda: Number(row.valor_venda),
      data_venda: String(row.data_venda),
      vendedor_id: row.vendedor_id ? String(row.vendedor_id) : null,
      lucro_liquido: lucro.lucroLiquido,
    });
  }
  return out;
}

async function loadComissaoMesMap(
  sb: PosicaoLojaDb,
  userId: string,
  competencia: string,
): Promise<Map<string, number>> {
  const { start, end } = intervaloCompetencia(competencia);
  const { data: vendas } = await sb.from("veiculo_venda").select("veiculo_id")
    .eq("user_id", userId).gte("data_venda", start).lte("data_venda", end);
  const ids = (vendas ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (!ids.length) return new Map();
  const { data: autos } = await sb.from("gestao_comissao_auto").select("vendedor_id, valor")
    .eq("user_id", userId).in("veiculo_id", ids);
  const map = new Map<string, number>();
  for (const a of autos ?? []) {
    const vid = String(a.vendedor_id);
    map.set(vid, (map.get(vid) ?? 0) + Number(a.valor));
  }
  return map;
}

async function loadMetaLoja(
  sb: PosicaoLojaDb,
  userId: string,
  competencia: string,
): Promise<GestaoMetaConfigJson | null> {
  const { data } = await sb.from("gestao_meta_mensal").select("config_json")
    .eq("user_id", userId).eq("competencia", competencia).is("vendedor_id", null).maybeSingle();
  if (!data?.config_json) return null;
  return data.config_json as GestaoMetaConfigJson;
}

async function loadMetaVendedor(
  sb: PosicaoLojaDb,
  userId: string,
  competencia: string,
  vendedorId: string,
): Promise<GestaoMetaConfigJson | null> {
  const { data } = await sb.from("gestao_meta_mensal").select("config_json")
    .eq("user_id", userId).eq("competencia", competencia).eq("vendedor_id", vendedorId).maybeSingle();
  if (!data?.config_json) return null;
  return data.config_json as GestaoMetaConfigJson;
}

function metaRealizadoFromConfig(
  config: GestaoMetaConfigJson,
  vendasMes: VendaEquipeLine[],
  dreLucroCarros: number,
  vendedorId?: string | null,
): number {
  const filtered = vendedorId
    ? vendasMes.filter((v) => v.vendedor_id === vendedorId)
    : vendasMes;
  if (config.tipo === "qtd") return filtered.length;
  if (config.tipo === "faturamento") {
    return filtered.reduce((a, v) => a + v.valor_venda, 0);
  }
  if (config.tipo === "lucro") {
    if (vendedorId) {
      return filtered.reduce((a, v) => a + (v.lucro_liquido ?? 0), 0);
    }
    return dreLucroCarros;
  }
  return filtered.length;
}

export function lojaNomeFromText(text: string): string | null {
  const m = text.match(/\bloja\s+([a-z0-9à-ú\s]{2,40})/i);
  return m ? m[1].trim() : null;
}

export async function loadPosicaoLojaFacts(
  sb: PosicaoLojaDb,
  userId: string,
  agoraSP: Date,
  opts?: { storeUserId?: string; lojaNomeCitada?: string | null },
): Promise<PosicaoLojaFacts> {
  const storeUserId = opts?.storeUserId ?? userId;
  const lojaNomeCitada = opts?.lojaNomeCitada ?? null;
  const competencia = competenciaFromDate(agoraSP);
  const today = hojeSaoPaulo();
  const { start: mesStart, end: mesEnd } = intervaloCompetencia(competencia);

  await syncRecorrenciaLancamentosDb(sb as never, storeUserId);

  const vendasDre = await loadVendasDreMes(sb, storeUserId, competencia);
  const { data: contasRaw } = await sb.from("gestao_conta_lancamento").select(
    "tipo, categoria_operacional, valor, vencimento, pago_em, recebido_em",
  ).eq("user_id", storeUserId).is("deleted_at", null);
  const ops = contasToDreOperacionalRows((contasRaw ?? []).map((c: Record<string, unknown>) => ({
    tipo: c.tipo as string,
    categoria_operacional: String(c.categoria_operacional ?? ""),
    valor: Number(c.valor),
    vencimento: String(c.vencimento ?? ""),
    pago_em: c.pago_em ? String(c.pago_em) : null,
  })));
  const dre = calcDreMes(competencia, vendasDre, ops);
  const margemCarros = dre.faturamento > 0 ? (dre.lucroCarros / dre.faturamento) * 100 : null;

  const metaCfg = await loadMetaLoja(sb, storeUserId, competencia);
  const vendasEquipe = await loadVendasEquipeComLucro(sb, storeUserId, competencia);
  let metaSalva = false;
  let metaRealizado: number | null = null;
  let metaValor: number | null = null;
  let metaPct: number | null = null;
  let metaProjecaoPct: number | null = null;
  if (metaCfg) {
    metaSalva = true;
    const realizado = metaRealizadoFromConfig(metaCfg, vendasEquipe, dre.lucroCarros);
    const p = calcMetaProgresso(metaCfg, realizado, agoraSP);
    metaRealizado = realizado;
    metaValor = metaCfg.metaValor;
    metaPct = p.pctAtingido;
    metaProjecaoPct = p.projecaoPct;
  }

  const { data: vendedoresRaw } = await sb.from("gestao_vendedores").select("id, nome, ativo")
    .eq("user_id", storeUserId).eq("ativo", true);
  const vendedores = (vendedoresRaw ?? []) as GestaoVendedorRow[];
  const comissaoMap = await loadComissaoMesMap(sb, storeUserId, competencia);
  const nomeById = new Map(vendedores.map((v) => [v.id, v.nome]));
  const vendedoresTop = buildRankingVendedores(
    vendasEquipe,
    comissaoMap,
    nomeById,
    competencia,
  ).slice(0, 5);

  const { data: veiculos } = await sb.from("veiculos_estoque").select(
    "id, status, preco, created_at",
  ).eq("user_id", storeUserId);
  let estoqueQtd = 0;
  let valorAnunciado = 0;
  let lucroProjetado = 0;
  let parados90Qtd = 0;
  let parados90Valor = 0;
  const nowMs = agoraSP.getTime();
  for (const v of veiculos ?? []) {
    const st = String(v.status ?? "");
    if (st === "vendido") continue;
    estoqueQtd += 1;
    const preco = v.preco != null ? Number(v.preco) : 0;
    valorAnunciado += preco;
    const vid = String(v.id);
    const [{ data: compra }, { data: despesas }] = await Promise.all([
      sb.from("veiculo_compra").select("valor_compra, data_compra")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle(),
      sb.from("veiculo_despesas").select("valor, categoria")
        .eq("user_id", storeUserId).eq("veiculo_id", vid).is("deleted_at", null),
    ]);
    const lucro = calcGestaoLucro({
      valorCompra: compra?.valor_compra != null ? Number(compra.valor_compra) : null,
      despesas: (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
        valor: Number(d.valor),
        categoria: d.categoria,
      })),
      valorVenda: null,
      precoAnunciado: preco > 0 ? preco : null,
      dataCompra: compra?.data_compra ? String(compra.data_compra) : null,
      dataVenda: null,
      statusVeiculo: st,
    });
    lucroProjetado += lucro.lucroProjetado ?? 0;
    const created = Date.parse(String(v.created_at ?? ""));
    const days = Number.isFinite(created)
      ? Math.floor((nowMs - created) / 86400000)
      : 0;
    if (days >= 90) {
      parados90Qtd += 1;
      parados90Valor += preco;
    }
  }

  const { data: despesasHoje } = await sb.from("veiculo_despesas").select("valor")
    .eq("user_id", storeUserId).eq("data", today).is("deleted_at", null);
  const despesasQtd = (despesasHoje ?? []).length;
  const despesasValor = (despesasHoje ?? []).reduce(
    (a: number, d: { valor: number }) => a + Number(d.valor),
    0,
  );

  const { count: vendasHojeCount } = await sb.from("veiculo_venda").select("id", { count: "exact", head: true })
    .eq("user_id", storeUserId).eq("data_venda", today);

  let leadsNovos: number | null = null;
  let conversasAtendidas: number | null = null;
  try {
    const dayStart = `${today}T00:00:00-03:00`;
    const dayEnd = `${today}T23:59:59-03:00`;
    const { count: leadsCount } = await sb.from("jarvis_leads").select("id", { count: "exact", head: true })
      .eq("user_id", storeUserId).gte("created_at", dayStart).lte("created_at", dayEnd);
    leadsNovos = leadsCount ?? 0;

    const { data: msgs } = await sb.from("whatsapp_cloud_messages").select("conversation_id, sender")
      .eq("user_id", storeUserId).gte("created_at", dayStart).lte("created_at", dayEnd).limit(3000);
    const convSet = new Set<string>();
    for (const m of msgs ?? []) {
      if (String(m.sender ?? "") === "campanha") continue;
      convSet.add(String(m.conversation_id));
    }
    conversasAtendidas = convSet.size;
  } catch {
    leadsNovos = null;
    conversasAtendidas = null;
  }

  const contas = contasRaw ?? [];
  let contasVencidasQtd = 0;
  let contasVencidasValor = 0;
  let contas7DiasQtd = 0;
  let contas7DiasValor = 0;
  const todayDate = new Date(`${today}T12:00:00`);
  const in7 = new Date(todayDate);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  for (const c of contas) {
    const tipo = String(c.tipo);
    if (tipo !== "pagar") continue;
    const venc = String(c.vencimento ?? "").slice(0, 10);
    const pago = c.pago_em;
    if (pago) continue;
    const val = Number(c.valor);
    if (venc < today) {
      contasVencidasQtd += 1;
      contasVencidasValor += val;
    } else if (venc >= today && venc <= in7Str) {
      contas7DiasQtd += 1;
      contas7DiasValor += val;
    }
  }

  let custoCompraPendenteQtd = 0;
  for (const v of veiculos ?? []) {
    if (String(v.status) === "vendido") continue;
    const vid = String(v.id);
    const { data: compra } = await sb.from("veiculo_compra").select("valor_compra")
      .eq("user_id", storeUserId).eq("veiculo_id", vid).maybeSingle();
    if (compra?.valor_compra == null) custoCompraPendenteQtd += 1;
  }

  const { data: vendasAbertas } = await sb.from("veiculo_venda").select("veiculo_id, marcou_vendido")
    .eq("user_id", storeUserId).gte("data_venda", mesStart).lte("data_venda", mesEnd);
  let vendaRegistradaSemVendidoQtd = 0;
  for (const v of vendasAbertas ?? []) {
    if (v.marcou_vendido) continue;
    const { data: veic } = await sb.from("veiculos_estoque").select("status")
      .eq("user_id", storeUserId).eq("id", v.veiculo_id).maybeSingle();
    if (veic && String(veic.status) !== "vendido") vendaRegistradaSemVendidoQtd += 1;
  }

  const { count: concCount } = await sb.from("gestao_extrato_transacao").select("id", { count: "exact", head: true })
    .eq("user_id", storeUserId).in("status", ["pendente", "confirmar"]);

  return {
    geradoEm: formatGeradoEm(agoraSP),
    competencia,
    mesLabel: mesNomePt(competencia),
    storeUserId,
    lojaNomeCitada,
    mes: {
      qtdVendas: dre.qtdVendas,
      faturamento: dre.faturamento,
      lucroCarros: dre.lucroCarros,
      margemCarrosPct: margemCarros,
      lucroLiquido: dre.lucroLiquidoLoja,
      metaSalva,
      metaRealizado,
      metaValor,
      metaPct,
      metaProjecaoPct,
    },
    vendedoresTop,
    estoque: {
      qtd: estoqueQtd,
      valorAnunciado,
      lucroProjetado,
      parados90Qtd,
      parados90ValorAnunciado: parados90Valor,
    },
    hoje: {
      despesasQtd,
      despesasValor,
      vendasQtd: vendasHojeCount ?? 0,
      leadsNovos,
      conversasAtendidas,
    },
    atencao: {
      contasVencidasQtd,
      contasVencidasValor,
      contas7DiasQtd,
      contas7DiasValor,
      custoCompraPendenteQtd,
      vendaRegistradaSemVendidoQtd,
      conciliacaoPendenteQtd: concCount ?? 0,
    },
  };
}

function appendGrupoLojaNote(text: string, lojaNome: string | null): string {
  if (!lojaNome) return text;
  return `${text}\n\n(Relatório da sua loja. Relatório por loja estará disponível no Painel do Grupo.)`;
}

export function formatPosicaoLojaWhatsApp(facts: PosicaoLojaFacts): string {
  const lines: string[] = [];
  lines.push(`📊 Posição da loja — ${facts.geradoEm}`);
  lines.push("");
  lines.push(`💰 MÊS (${facts.mesLabel})`);
  lines.push(
    `Vendidos: ${facts.mes.qtdVendas} carros · ${formatPosicaoMoney(facts.mes.faturamento)}`,
  );
  const margemTxt = facts.mes.margemCarrosPct != null
    ? ` (${facts.mes.margemCarrosPct.toFixed(1).replace(".", ",")}%)`
    : "";
  lines.push(`Lucro dos carros: ${formatPosicaoMoney(facts.mes.lucroCarros)}${margemTxt}`);
  lines.push(
    `Lucro líquido: ${formatPosicaoMoney(facts.mes.lucroLiquido)} (já com as despesas da loja)`,
  );
  if (facts.mes.metaSalva && facts.mes.metaValor != null && facts.mes.metaRealizado != null) {
    const pct = facts.mes.metaPct ?? 0;
    const proj = facts.mes.metaProjecaoPct ?? 0;
    lines.push(
      `Meta: ${Math.round(facts.mes.metaRealizado)} de ${facts.mes.metaValor} (${Math.round(pct)}%) · no ritmo atual fecha em ${Math.round(proj)}%`,
    );
  }

  if (facts.vendedoresTop.length) {
    lines.push("");
    lines.push("👥 VENDEDORES");
    for (const v of facts.vendedoresTop) {
      lines.push(
        `${v.nome}: ${v.qtd} carros · ${formatPosicaoMoney(v.faturamento)} · comissão ${formatGestaoMoney(v.comissao)}`,
      );
    }
  }

  lines.push("");
  lines.push("🚗 ESTOQUE");
  lines.push(
    `${facts.estoque.qtd} carros · ${formatPosicaoMoney(facts.estoque.valorAnunciado)} anunciado · lucro projetado ${formatPosicaoMoney(facts.estoque.lucroProjetado)}`,
  );
  if (facts.estoque.parados90Qtd > 0) {
    lines.push(
      `Parados há +90 dias: ${facts.estoque.parados90Qtd} (${formatPosicaoMoney(facts.estoque.parados90ValorAnunciado)} anunciado)`,
    );
  } else {
    lines.push("Parados há +90 dias: nenhum");
  }

  lines.push("");
  lines.push("📅 HOJE");
  lines.push(`Despesas lançadas: ${facts.hoje.despesasQtd} · ${formatGestaoMoney(facts.hoje.despesasValor)}`);
  if (facts.hoje.vendasQtd > 0) {
    lines.push(`Vendas registradas hoje: ${facts.hoje.vendasQtd}`);
  }
  if (facts.hoje.leadsNovos != null && facts.hoje.conversasAtendidas != null) {
    lines.push(`Leads novos: ${facts.hoje.leadsNovos} · conversas atendidas: ${facts.hoje.conversasAtendidas}`);
  }

  lines.push("");
  lines.push("⚠️ ATENÇÃO");
  const alertas: string[] = [];
  if (facts.atencao.contasVencidasQtd > 0) {
    alertas.push(
      `${facts.atencao.contasVencidasQtd} conta(s) vencida(s) em aberto (${formatGestaoMoney(facts.atencao.contasVencidasValor)})`,
    );
  }
  if (facts.atencao.contas7DiasQtd > 0) {
    alertas.push(
      `${facts.atencao.contas7DiasQtd} conta(s) vencem em 7 dias (${formatGestaoMoney(facts.atencao.contas7DiasValor)})`,
    );
  }
  if (facts.atencao.custoCompraPendenteQtd > 0) {
    alertas.push(`${facts.atencao.custoCompraPendenteQtd} carro(s) com custo de compra pendente`);
  }
  if (facts.atencao.vendaRegistradaSemVendidoQtd > 0) {
    alertas.push(`${facts.atencao.vendaRegistradaSemVendidoQtd} venda(s) registrada(s) sem marcar vendido`);
  }
  if (facts.atencao.conciliacaoPendenteQtd > 0) {
    alertas.push(`${facts.atencao.conciliacaoPendenteQtd} transação(ões) de conciliação pendente(s)`);
  }
  lines.push(alertas.length ? alertas.join("\n") : "Nada pendente ✅");

  let text = lines.join("\n");
  if (text.length > 1500) text = `${text.slice(0, 1497)}…`;
  return appendGrupoLojaNote(text, facts.lojaNomeCitada);
}

export type RelatorioVendedoresFacts = {
  competencia: string;
  mesLabel: string;
  diaRef: string;
  ranking: RankingVendedor[];
  metaByVendedorId: Map<string, { pct: number; realizado: number; meta: number }>;
  lojaNomeCitada: string | null;
};

export async function loadRelatorioVendedoresFacts(
  sb: PosicaoLojaDb,
  userId: string,
  agoraSP: Date,
  opts?: { storeUserId?: string; lojaNomeCitada?: string | null },
): Promise<RelatorioVendedoresFacts> {
  const storeUserId = opts?.storeUserId ?? userId;
  const lojaNomeCitada = opts?.lojaNomeCitada ?? null;
  const competencia = competenciaFromDate(agoraSP);
  const vendasEquipe = await loadVendasEquipeComLucro(sb, storeUserId, competencia);
  const { data: vendedoresRaw } = await sb.from("gestao_vendedores").select("id, nome, ativo")
    .eq("user_id", storeUserId).eq("ativo", true);
  const vendedores = (vendedoresRaw ?? []) as GestaoVendedorRow[];
  const comissaoMap = await loadComissaoMesMap(sb, storeUserId, competencia);
  const nomeById = new Map(vendedores.map((v) => [v.id, v.nome]));
  const ranking = buildRankingVendedores(vendasEquipe, comissaoMap, nomeById, competencia);

  const metaByVendedorId = new Map<string, { pct: number; realizado: number; meta: number }>();
  for (const v of vendedores) {
    const cfg = await loadMetaVendedor(sb, storeUserId, competencia, v.id);
    if (!cfg) continue;
    const realizado = metaRealizadoFromConfig(cfg, vendasEquipe, 0, v.id);
    const p = calcMetaProgresso(cfg, realizado, agoraSP);
    metaByVendedorId.set(v.id, { pct: p.pctAtingido, realizado, meta: cfg.metaValor });
  }

  const diaRef = agoraSP.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });

  return {
    competencia,
    mesLabel: mesNomePt(competencia),
    diaRef,
    ranking,
    metaByVendedorId,
    lojaNomeCitada,
  };
}

export function formatRelatorioVendedoresWhatsApp(facts: RelatorioVendedoresFacts): string {
  const lines: string[] = [];
  lines.push(`👥 Vendedores — ${facts.mesLabel} (até ${facts.diaRef})`);
  lines.push("");
  if (!facts.ranking.length) {
    lines.push("Nenhuma venda registrada no mês.");
    return appendGrupoLojaNote(lines.join("\n"), facts.lojaNomeCitada);
  }
  facts.ranking.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.nome}`);
    lines.push(
      `   ${r.qtd} carros · ${formatPosicaoMoney(r.faturamento)} · lucro gerado ${formatPosicaoMoney(r.lucroGerado)}`,
    );
    let comLine = `   Comissão: ${formatGestaoMoney(r.comissao)}`;
    if (r.vendedor_id) {
      const m = facts.metaByVendedorId.get(r.vendedor_id);
      if (m) comLine += ` · Meta: ${Math.round(m.realizado)} de ${m.meta} (${Math.round(m.pct)}%)`;
    }
    lines.push(comLine);
    lines.push("");
  });
  const totalCarros = facts.ranking.reduce((a, r) => a + r.qtd, 0);
  const totalCom = facts.ranking.reduce((a, r) => a + r.comissao, 0);
  let destaque = "";
  const comLucro = facts.ranking.filter((r) => r.qtd > 0);
  if (comLucro.length) {
    const best = [...comLucro].sort(
      (a, b) => (b.lucroGerado / b.qtd) - (a.lucroGerado / a.qtd),
    )[0];
    if (best) destaque = best.nome;
  }
  lines.push(`Total: ${totalCarros} carros · comissões ${formatGestaoMoney(totalCom)}`);
  if (destaque) lines.push(`Destaque: ${destaque} (maior lucro por carro)`);
  let text = lines.join("\n");
  if (text.length > 1500) text = `${text.slice(0, 1497)}…`;
  return appendGrupoLojaNote(text, facts.lojaNomeCitada);
}

export async function formatVendedorDetalheWhatsApp(
  sb: PosicaoLojaDb,
  userId: string,
  hint: string,
  agoraSP: Date,
  opts?: { storeUserId?: string },
): Promise<string> {
  const storeUserId = opts?.storeUserId ?? userId;
  const { data: vendedoresRaw } = await sb.from("gestao_vendedores").select("id, nome, ativo")
    .eq("user_id", storeUserId).eq("ativo", true);
  const vendedores = (vendedoresRaw ?? []) as GestaoVendedorRow[];
  const v = matchGestaoVendedor(hint, vendedores);
  if (!v) return "Não encontrei esse vendedor.";

  const competencia = competenciaFromDate(agoraSP);
  const facts = await loadRelatorioVendedoresFacts(sb, userId, agoraSP, opts);
  const row = facts.ranking.find((r) => r.vendedor_id === v.id);
  if (!row) {
    return `${v.nome} em ${facts.mesLabel}: nenhuma venda registrada ainda.`;
  }
  const m = facts.metaByVendedorId.get(v.id);
  const metaLine = m
    ? ` Meta: ${Math.round(m.realizado)} de ${m.meta} (${Math.round(m.pct)}%).`
    : "";
  return `${v.nome} em ${facts.mesLabel}: ${row.qtd} carro(s), faturamento ${formatPosicaoMoney(row.faturamento)}, lucro gerado ${formatPosicaoMoney(row.lucroGerado)}, comissão ${formatGestaoMoney(row.comissao)}.${metaLine}`;
}

/** Painel Jarvis: mesmo conteúdo, sem emojis duplicados no polish (texto já formatado). */
export function formatPosicaoLojaPainel(facts: PosicaoLojaFacts): string {
  return formatPosicaoLojaWhatsApp(facts);
}

