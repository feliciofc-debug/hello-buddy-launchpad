import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcGestaoLucro } from "./gestao-lucro-calc.ts";
import { loadGestaoAuthContext } from "./gestao-auth-phone.ts";
import { loadGiroResumoItens } from "./giro-resumo-load.ts";
import type { GiroResumoVeiculoLinha } from "./giro-resumo-mensagem.ts";
import { normalizeOwnerPhone, ownerPhoneVariants } from "./owner-phone.ts";
import { VEICULO_STATUS_ATIVOS_INTERNOS } from "./veiculo-estoque-status.ts";
import { dateKeySaoPaulo } from "./vitrine-crm-time.ts";

export type FechamentoVenda = {
  qtd: number;
  faturamento: number;
  lucro: number;
  margemPct: number | null;
  ticketMedio: number | null;
};

export type GestaoFechamentoDia = {
  dia: string;
  lojaNome: string;
  vendasHoje: FechamentoVenda;
  vendasMes: FechamentoVenda;
  comparacaoMesAnteriorPct: number | null;
  estoque: {
    total: number;
    valorImobilizado: number | null;
    entradasHoje: number;
    saidasHoje: number;
    emPreparacao: number;
    consignados: number;
  };
  custoEstoque: {
    hoje: number | null;
    mes: number | null;
    dias30: number;
    dias60: number;
    dias90Mais: number;
    top3: Array<{
      label: string;
      dias: number;
      custoMes: number;
      margemConsumidaPct: number | null;
    }>;
  };
  operacao: {
    osAbertas: number;
    osEmCotacao: number;
    cotacoesRecebidasHoje: number;
    osParadas: number;
    preparacaoParada: number;
    cotacaoOsNumero?: number | null;
  };
  financeiro: {
    pagar7Dias: number;
    receber7Dias: number;
    pagarVencido: number;
    receberVencido: number;
    despesaOperacionalHoje: number;
    repasseHoje: number;
    trocoHoje: number;
    custoVeiculoHoje: number;
  } | null;
  atendimento: {
    conversasHoje: number | null;
    leadsNovos: number | null;
    leadsQuentesSemRetorno24h: number | null;
  };
  acoes: string[];
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const round = (value: number) => Math.round(value * 100) / 100;

/** Comparação de dia civil em America/Sao_Paulo (timestamps) ou YYYY-MM-DD (date). */
export function isEventoNoDiaSp(val: unknown, dia: string): boolean {
  if (val == null || val === "") return false;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s === dia;
  const parsed = Date.parse(s);
  if (!Number.isFinite(parsed)) return s.slice(0, 10) === dia;
  return dateKeySaoPaulo(new Date(parsed)) === dia;
}

/** PostgREST: contas em aberto ou liquidadas no dia (evita scan completo). */
export function montarFiltroContasFechamento(dia: string): string {
  return [
    "and(tipo.eq.pagar,pago_em.is.null)",
    "and(tipo.eq.receber,recebido_em.is.null)",
    `pago_em.eq.${dia}`,
    `recebido_em.eq.${dia}`,
  ].join(",");
}

export function formatarCabecalhoFechamento(lojaNome: string, dia: string): string {
  const [ys, ms, ds] = dia.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const weekday = new Date(Date.UTC(y, m - 1, d, 15)).toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  });
  const nome = lojaNome.trim() || "Minha loja";
  return `📊 *FECHAMENTO DO DIA — ${nome} · ${ds}/${ms} (${weekday})*`;
}

/** Conversa de cliente: exclui dono, gestores e parceiros. */
export function contatoInternoFechamento(
  contactNumber: string,
  internos: Set<string>,
): boolean {
  const normalized = normalizeOwnerPhone(contactNumber);
  if (!normalized) return true;
  for (const v of ownerPhoneVariants(contactNumber)) {
    if (internos.has(v)) return true;
  }
  return false;
}

function venda(
  qtd: number,
  faturamento: number,
  lucro: number,
): FechamentoVenda {
  return {
    qtd,
    faturamento: round(faturamento),
    lucro: round(lucro),
    margemPct: faturamento > 0 ? round(lucro / faturamento * 100) : null,
    ticketMedio: qtd > 0 ? round(faturamento / qtd) : null,
  };
}

export function formatarGestaoFechamentoDia(
  f: GestaoFechamentoDia,
  limite = 3500,
): string {
  const sections: string[][] = [];
  sections.push([formatarCabecalhoFechamento(f.lojaNome, f.dia)]);

  const vendas = ["🚗 *VENDAS*"];
  if (f.vendasHoje.qtd > 0) {
    vendas.push(
      `Hoje: ${f.vendasHoje.qtd} · ${
        money(f.vendasHoje.faturamento)
      } · lucro bruto ${money(f.vendasHoje.lucro)}` +
        (f.vendasHoje.margemPct == null
          ? ""
          : ` · margem ${pct(f.vendasHoje.margemPct)}`),
    );
  } else {
    vendas.push("Hoje: nenhuma venda");
  }
  if (f.vendasMes.qtd > 0) {
    vendas.push(
      `Mês: ${f.vendasMes.qtd} · ${money(f.vendasMes.faturamento)} · lucro ${
        money(f.vendasMes.lucro)
      }` +
        (f.vendasMes.ticketMedio == null
          ? ""
          : ` · ticket ${money(f.vendasMes.ticketMedio)}`),
    );
  }
  if (f.comparacaoMesAnteriorPct != null) {
    const sinal = f.comparacaoMesAnteriorPct > 0 ? "+" : "";
    vendas.push(
      `Mês vs. mesmo período do mês anterior (faturamento): ${sinal}${
        pct(f.comparacaoMesAnteriorPct)
      }`,
    );
  }
  sections.push(vendas);

  const estoque = ["📦 *ESTOQUE*"];
  estoque.push(
    `${f.estoque.total} carros` +
      (f.estoque.valorImobilizado == null
        ? ""
        : ` · ${money(f.estoque.valorImobilizado)} imobilizado`) +
      ` · entradas ${f.estoque.entradasHoje} · saídas ${f.estoque.saidasHoje}`,
  );
  if (f.estoque.emPreparacao > 0) {
    estoque.push(`Em preparação: ${f.estoque.emPreparacao}`);
  }
  if (f.estoque.consignados > 0) {
    estoque.push(`Consignados: ${f.estoque.consignados}`);
  }
  sections.push(estoque);

  const custo = ["💸 *CUSTO DO ESTOQUE PARADO*"];
  if (f.custoEstoque.hoje != null) {
    custo.push(`Hoje: ${money(f.custoEstoque.hoje)}`);
  }
  if (f.custoEstoque.mes != null) {
    custo.push(
      `Acumulado do mês (carros em estoque): ${money(f.custoEstoque.mes)}`,
    );
  }
  custo.push(
    `Faixas: 30 dias ${f.custoEstoque.dias30} · 60 dias ${f.custoEstoque.dias60} · 90+ dias ${f.custoEstoque.dias90Mais}`,
  );
  if (f.custoEstoque.top3.length) {
    custo.push("Mais custosos no mês:");
    for (const [i, item] of f.custoEstoque.top3.entries()) {
      custo.push(
        `${i + 1}. ${item.label} · ${item.dias} dias · ${
          money(item.custoMes)
        }` +
          (item.margemConsumidaPct == null
            ? ""
            : ` · margem consumida ${pct(item.margemConsumidaPct)}`),
      );
    }
  }
  sections.push(custo);

  const op = ["🔧 *OPERAÇÃO*"];
  op.push(
    `OS abertas: ${f.operacao.osAbertas} · em cotação: ${f.operacao.osEmCotacao}`,
  );
  if (f.operacao.cotacoesRecebidasHoje > 0) {
    op.push(
      `Cotações recebidas hoje aguardando escolha: ${f.operacao.cotacoesRecebidasHoje}`,
    );
  }
  if (f.operacao.osParadas > 0) {
    op.push(`OS além do alerta: ${f.operacao.osParadas}`);
  }
  if (f.operacao.preparacaoParada > 0) {
    op.push(
      `Carros em preparação além do alerta: ${f.operacao.preparacaoParada}`,
    );
  }
  sections.push(op);

  if (f.financeiro) {
    const fin = ["💰 *FINANCEIRO*"];
    fin.push(
      `Próximos 7 dias: pagar ${money(f.financeiro.pagar7Dias)} · receber ${
        money(f.financeiro.receber7Dias)
      }`,
    );
    if (f.financeiro.pagarVencido > 0 || f.financeiro.receberVencido > 0) {
      fin.push(
        `Vencidos: pagar ${money(f.financeiro.pagarVencido)} · receber ${
          money(f.financeiro.receberVencido)
        }`,
      );
    }
    fin.push(
      `Despesa operacional hoje: ${money(f.financeiro.despesaOperacionalHoje)}`,
    );
    const apartes: string[] = [];
    if (f.financeiro.repasseHoje > 0) {
      apartes.push(`repasse ${money(f.financeiro.repasseHoje)}`);
    }
    if (f.financeiro.trocoHoje > 0) {
      apartes.push(`troco ${money(f.financeiro.trocoHoje)}`);
    }
    if (f.financeiro.custoVeiculoHoje > 0) {
      apartes.push(`custo de veículo ${money(f.financeiro.custoVeiculoHoje)}`);
    }
    if (apartes.length) fin.push(`À parte: ${apartes.join(" · ")}`);
    sections.push(fin);
  }

  const atendimento = ["💬 *ATENDIMENTO*"];
  if (f.atendimento.conversasHoje != null) {
    atendimento.push(
      `Conversas atendidas pelo Jarvis: ${f.atendimento.conversasHoje}`,
    );
  }
  if (f.atendimento.leadsNovos != null) {
    atendimento.push(`Leads novos: ${f.atendimento.leadsNovos}`);
  }
  if (f.atendimento.leadsQuentesSemRetorno24h != null) {
    atendimento.push(
      `Leads quentes sem retorno há +24h: ${f.atendimento.leadsQuentesSemRetorno24h}`,
    );
  }
  if (atendimento.length > 1) sections.push(atendimento);

  if (f.acoes.length) {
    sections.push([
      "✅ *DECIDA HOJE*",
      ...f.acoes.slice(0, 3).map((a) => `• ${a}`),
    ]);
  }

  let text = sections.map((s) => s.join("\n")).join("\n\n");
  if (text.length <= limite) return text;

  const semTop = { ...f, custoEstoque: { ...f.custoEstoque, top3: [] } };
  text = formatarGestaoFechamentoDia(semTop, Number.MAX_SAFE_INTEGER);
  if (text.length <= limite) return text;
  return `${text.slice(0, limite - 1).trimEnd()}…`;
}

type VendaRow = { veiculo_id: string; valor_venda: number; data_venda: string };

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function previousMonthSameDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  return `${
    new Date(Date.UTC(y, m - 2, Math.min(d, last))).toISOString().slice(0, 10)
  }`;
}

async function loadTelefonesInternos(
  sb: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const ctx = await loadGestaoAuthContext(sb, userId);
  const { data: parceiros } = await sb.from("gestao_parceiro")
    .select("whatsapp_e164")
    .eq("user_id", userId)
    .eq("ativo", true);
  const internos = new Set<string>();
  for (const raw of [ctx.ownerPhone, ...ctx.ownerAltPhones, ...ctx.gestores]) {
    for (const v of ownerPhoneVariants(raw)) internos.add(v);
  }
  for (const row of parceiros ?? []) {
    for (const v of ownerPhoneVariants(String(row.whatsapp_e164 ?? ""))) {
      if (v) internos.add(v);
    }
  }
  return internos;
}

async function contarConversasClientesNoDia(
  sb: SupabaseClient,
  userId: string,
  dia: string,
  dayStart: string,
  dayEnd: string,
  internos: Set<string>,
): Promise<number> {
  const { data: convs } = await sb.from("whatsapp_cloud_conversations")
    .select("id, contact_number")
    .eq("user_id", userId);
  const clientIds = (convs ?? [])
    .filter((c) => !contatoInternoFechamento(String(c.contact_number ?? ""), internos))
    .map((c) => String(c.id));
  if (!clientIds.length) return 0;

  const counted = new Set<string>();
  const chunkSize = 150;
  for (let i = 0; i < clientIds.length; i += chunkSize) {
    const chunk = clientIds.slice(i, i + chunkSize);
    let offset = 0;
    while (true) {
      const { data: msgs } = await sb.from("whatsapp_cloud_messages")
        .select("conversation_id, sender, created_at")
        .eq("user_id", userId)
        .in("conversation_id", chunk)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .range(offset, offset + 999);
      if (!msgs?.length) break;
      for (const m of msgs) {
        if (String(m.sender ?? "") === "campanha") continue;
        if (!isEventoNoDiaSp(m.created_at, dia)) continue;
        counted.add(String(m.conversation_id));
      }
      if (msgs.length < 1000) break;
      offset += 1000;
    }
  }
  return counted.size;
}

async function resumoVendas(
  sb: SupabaseClient,
  userId: string,
  rows: VendaRow[],
): Promise<FechamentoVenda> {
  if (!rows.length) return venda(0, 0, 0);
  const ids = [...new Set(rows.map((r) => r.veiculo_id))];
  const [{ data: compras }, { data: despesas }] = await Promise.all([
    sb.from("veiculo_compra").select("veiculo_id, valor_compra, data_compra")
      .eq("user_id", userId).in("veiculo_id", ids),
    sb.from("veiculo_despesas").select("veiculo_id, valor, categoria")
      .eq("user_id", userId).in("veiculo_id", ids).is("deleted_at", null),
  ]);
  const compraBy = new Map(
    (compras ?? []).map((c: { veiculo_id: string; valor_compra: number; data_compra: string }) => [
      String(c.veiculo_id),
      c,
    ]),
  );
  const despBy = new Map<string, Array<{ valor: number; categoria: string }>>();
  for (const d of despesas ?? []) {
    const vid = String((d as { veiculo_id: string }).veiculo_id);
    const list = despBy.get(vid) ?? [];
    list.push({
      valor: Number((d as { valor: number }).valor),
      categoria: String((d as { categoria: string }).categoria ?? ""),
    });
    despBy.set(vid, list);
  }

  let lucro = 0;
  for (const row of rows) {
    const compra = compraBy.get(String(row.veiculo_id));
    const calc = calcGestaoLucro({
      valorCompra: compra?.valor_compra == null
        ? null
        : Number(compra.valor_compra),
      despesas: despBy.get(String(row.veiculo_id)) ?? [],
      valorVenda: Number(row.valor_venda),
      precoAnunciado: null,
      dataCompra: compra?.data_compra ?? null,
      dataVenda: row.data_venda,
      statusVeiculo: "vendido",
    });
    lucro += calc.lucroBruto ?? 0;
  }
  return venda(
    rows.length,
    rows.reduce((sum, row) => sum + Number(row.valor_venda), 0),
    lucro,
  );
}

function custoGiro(
  items: GiroResumoVeiculoLinha[],
  dia: string,
): GestaoFechamentoDia["custoEstoque"] {
  const diaMes = Number(dia.slice(8, 10));
  const linhas = items.map((item) => {
    const diario = item.resultado.custoDeEsperar30d == null
      ? null
      : Math.max(0, item.resultado.custoDeEsperar30d / 30);
    const diasNoMes = Math.min(diaMes, Math.max(0, item.dias + 1));
    const custoMes = diario == null ? null : round(diario * diasNoMes);
    const margem = item.resultado.margemVarejoHoje;
    const consumida =
      custoMes != null && margem != null && margem + custoMes > 0
        ? round(custoMes / (margem + custoMes) * 100)
        : null;
    return { item, diario, custoMes, consumida };
  });
  const comCusto = linhas.filter((x) => x.diario != null);
  return {
    hoje: comCusto.length
      ? round(comCusto.reduce((s, x) => s + (x.diario ?? 0), 0))
      : null,
    mes: comCusto.length
      ? round(comCusto.reduce((s, x) => s + (x.custoMes ?? 0), 0))
      : null,
    dias30: items.filter((x) => x.dias >= 30 && x.dias < 60).length,
    dias60: items.filter((x) => x.dias >= 60 && x.dias < 90).length,
    dias90Mais: items.filter((x) => x.dias >= 90).length,
    top3: comCusto
      .sort((a, b) => (b.custoMes ?? 0) - (a.custoMes ?? 0))
      .slice(0, 3)
      .map((x) => ({
        label: x.item.label,
        dias: x.item.dias,
        custoMes: x.custoMes ?? 0,
        margemConsumidaPct: x.consumida,
      })),
  };
}

export async function buildGestaoFechamentoDia(
  sb: SupabaseClient,
  userId: string,
  dia: string,
  opts: {
    financeiroPermitido?: boolean;
    giroItems?: GiroResumoVeiculoLinha[];
  } = {},
): Promise<{ dados: GestaoFechamentoDia; texto: string }> {
  const inicioMes = monthStart(dia);
  const fim7 = addDays(dia, 7);
  const prevEnd = previousMonthSameDay(dia);
  const prevStart = monthStart(prevEnd);
  const dayStart = `${dia}T00:00:00-03:00`;
  const dayEnd = `${dia}T23:59:59-03:00`;
  const cutoff24h = `${addDays(dia, -1)}T23:59:59-03:00`;
  const statusAtivos = [...VEICULO_STATUS_ATIVOS_INTERNOS];

  const [
    { data: vendasMesRaw },
    { data: vendasPrevRaw },
    { data: veiculosRaw },
    { data: consignacoesRaw },
    { data: osRaw },
    { data: cotacoesRaw },
    { data: osConfig },
    { data: empresa },
    { data: contasRaw },
    { count: leadsNovos },
    { count: leadsQuentes },
    { data: comprasEntradaRaw },
    internos,
  ] = await Promise.all([
    sb.from("veiculo_venda").select("veiculo_id,valor_venda,data_venda")
      .eq("user_id", userId).gte("data_venda", inicioMes).lte("data_venda", dia),
    sb.from("veiculo_venda").select("veiculo_id,valor_venda,data_venda")
      .eq("user_id", userId).gte("data_venda", prevStart).lte("data_venda", prevEnd),
    sb.from("veiculos_estoque").select(
      "id,marca,modelo,ano_modelo,status,created_at,updated_at",
    )
      .eq("user_id", userId)
      .in("status", statusAtivos),
    sb.from("veiculo_consignacao").select("veiculo_id,status").eq(
      "user_id",
      userId,
    ).eq("status", "ativo"),
    sb.from("gestao_os").select("id,numero,status,ultima_movimentacao_em")
      .eq("user_id", userId).not("status", "in", '("concluida","cancelada")'),
    sb.from("gestao_os_cotacao").select("os_id,status,recebida_em")
      .eq("user_id", userId).eq("status", "recebida"),
    sb.from("gestao_os_config").select(
      "alerta_os_parada_dias,alerta_preparacao_parada_dias",
    )
      .eq("user_id", userId).maybeSingle(),
    sb.from("empresa_config").select("nome_empresa").eq("user_id", userId).maybeSingle(),
    sb.from("gestao_conta_lancamento")
      .select("tipo,natureza,valor,vencimento,pago_em,recebido_em,created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or(montarFiltroContasFechamento(dia)),
    sb.from("jarvis_leads").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", dayStart).lte("created_at", dayEnd),
    sb.from("lead_notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "quente").eq("visualizado", false).lt(
        "created_at",
        cutoff24h,
      ),
    sb.from("veiculo_compra").select("veiculo_id")
      .eq("user_id", userId).eq("data_compra", dia),
    loadTelefonesInternos(sb, userId),
  ]);

  const lojaNome = String(empresa?.nome_empresa ?? "").trim() || "Minha loja";
  const ativos = veiculosRaw ?? [];
  const activeIds = ativos.map((v) => String(v.id));

  let comprasAtivosRaw: Array<{ veiculo_id: string; valor_compra: number | null }> = [];
  if (activeIds.length) {
    const { data } = await sb.from("veiculo_compra")
      .select("veiculo_id,valor_compra")
      .eq("user_id", userId)
      .in("veiculo_id", activeIds);
    comprasAtivosRaw = data ?? [];
  }

  const vendasMesRows = (vendasMesRaw ?? []) as VendaRow[];
  const vendasHojeRows = vendasMesRows.filter((x) =>
    String(x.data_venda).slice(0, 10) === dia
  );
  const [vendasHoje, vendasMes, vendasPrev] = await Promise.all([
    resumoVendas(sb, userId, vendasHojeRows),
    resumoVendas(sb, userId, vendasMesRows),
    resumoVendas(sb, userId, (vendasPrevRaw ?? []) as VendaRow[]),
  ]);
  const comparacaoMesAnteriorPct = vendasPrev.faturamento > 0
    ? round(
      (vendasMes.faturamento - vendasPrev.faturamento) /
        vendasPrev.faturamento * 100,
    )
    : null;

  const consignados = new Set(
    (consignacoesRaw ?? []).map((x) => String(x.veiculo_id)),
  );
  const valorImobilizadoRows = comprasAtivosRaw.filter((c) =>
    !consignados.has(String(c.veiculo_id))
  );
  const valorImobilizado =
    valorImobilizadoRows.some((c) => c.valor_compra != null)
      ? round(
        valorImobilizadoRows.reduce(
          (s, c) => s + Number(c.valor_compra ?? 0),
          0,
        ),
      )
      : null;

  const giroItems = opts.giroItems ??
    (await loadGiroResumoItens(sb, userId, dia)).items;
  const custoEstoque = custoGiro(giroItems, dia);

  const os = osRaw ?? [];
  const cotacoes = cotacoesRaw ?? [];
  const osAlerta = Number(osConfig?.alerta_os_parada_dias ?? 7);
  const prepAlerta = Number(osConfig?.alerta_preparacao_parada_dias ?? 15);
  const limiteOs = Date.parse(`${addDays(dia, -osAlerta)}T00:00:00-03:00`);
  const limitePrep = Date.parse(`${addDays(dia, -prepAlerta)}T00:00:00-03:00`);
  const osParadas = os.filter((x) =>
    Date.parse(String(x.ultima_movimentacao_em)) < limiteOs
  ).length;
  const preparacaoParada = ativos.filter((x) =>
    String(x.status) === "em_preparacao" &&
    Date.parse(String(x.updated_at ?? x.created_at)) < limitePrep
  ).length;
  const recebidasHoje = cotacoes.filter((x) =>
    isEventoNoDiaSp(x.recebida_em, dia)
  );
  const primeiraCotacaoOs = os.find((x) =>
    recebidasHoje.some((c) => String(c.os_id) === String(x.id))
  );

  const financeiroPermitido = opts.financeiroPermitido !== false;
  let financeiro: GestaoFechamentoDia["financeiro"] = null;
  if (financeiroPermitido) {
    const contas = contasRaw ?? [];
    const soma = (pred: (c: Record<string, unknown>) => boolean) =>
      round(contas.filter(pred).reduce((s, c) => s + Number(c.valor ?? 0), 0));
    const emAberto = (c: Record<string, unknown>) =>
      String(c.tipo) === "pagar" ? !c.pago_em : !c.recebido_em;
    const pagoNoDia = (c: Record<string, unknown>) =>
      isEventoNoDiaSp(c.pago_em ?? c.recebido_em, dia);
    financeiro = {
      pagar7Dias: soma((c) =>
        c.tipo === "pagar" && emAberto(c) && String(c.vencimento) >= dia &&
        String(c.vencimento) <= fim7
      ),
      receber7Dias: soma((c) =>
        c.tipo === "receber" && emAberto(c) && String(c.vencimento) >= dia &&
        String(c.vencimento) <= fim7
      ),
      pagarVencido: soma((c) =>
        c.tipo === "pagar" && emAberto(c) && String(c.vencimento) < dia
      ),
      receberVencido: soma((c) =>
        c.tipo === "receber" && emAberto(c) && String(c.vencimento) < dia
      ),
      despesaOperacionalHoje: soma((c) =>
        c.tipo === "pagar" && c.natureza === "operacional" && pagoNoDia(c)
      ),
      repasseHoje: soma((c) =>
        c.natureza === "repasse_terceiro" && pagoNoDia(c)
      ),
      trocoHoje: soma((c) => c.natureza === "troco_cliente" && pagoNoDia(c)),
      custoVeiculoHoje: soma((c) =>
        c.natureza === "custo_veiculo" && pagoNoDia(c)
      ),
    };
  }

  const conversasHoje = await contarConversasClientesNoDia(
    sb,
    userId,
    dia,
    dayStart,
    dayEnd,
    internos,
  );

  const acoes: string[] = [];
  const carro90 =
    giroItems.filter((x) => x.dias >= 90).sort((a, b) => b.dias - a.dias)[0];
  if (carro90) {
    acoes.push(
      `Avaliar preço ou repasse do ${carro90.label} (${carro90.dias} dias)`,
    );
  }
  if (recebidasHoje.length) {
    acoes.push(
      primeiraCotacaoOs?.numero
        ? `Escolher cotação da OS #${primeiraCotacaoOs.numero}`
        : "Escolher cotação recebida hoje",
    );
  }
  const amanha = addDays(dia, 1);
  if (
    financeiro &&
    (contasRaw ?? []).some((c) =>
      c.tipo === "pagar" && !c.pago_em && String(c.vencimento) === amanha
    )
  ) acoes.push("Revisar conta que vence amanhã");
  if ((leadsQuentes ?? 0) > 0) {
    acoes.push(`Retornar ${leadsQuentes} lead(s) quente(s) sem resposta`);
  }

  const dados: GestaoFechamentoDia = {
    dia,
    lojaNome,
    vendasHoje,
    vendasMes,
    comparacaoMesAnteriorPct,
    estoque: {
      total: ativos.length,
      valorImobilizado,
      entradasHoje: (comprasEntradaRaw ?? []).length,
      saidasHoje: vendasHoje.qtd,
      emPreparacao:
        ativos.filter((x) => String(x.status) === "em_preparacao").length,
      consignados: consignados.size,
    },
    custoEstoque,
    operacao: {
      osAbertas: os.length,
      osEmCotacao: os.filter((x) => String(x.status) === "orcamento").length,
      cotacoesRecebidasHoje: recebidasHoje.length,
      osParadas,
      preparacaoParada,
      cotacaoOsNumero: primeiraCotacaoOs?.numero == null
        ? null
        : Number(primeiraCotacaoOs.numero),
    },
    financeiro,
    atendimento: {
      conversasHoje,
      leadsNovos: leadsNovos ?? 0,
      leadsQuentesSemRetorno24h: leadsQuentes ?? 0,
    },
    acoes: acoes.slice(0, 3),
  };
  return { dados, texto: formatarGestaoFechamentoDia(dados) };
}
