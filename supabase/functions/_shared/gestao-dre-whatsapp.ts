import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcDreMes, type GestaoDreMes, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import { contasToDreOperacionalRows } from "./gestao-contador-data.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { formatYmdSaoPaulo, hojeSaoPaulo, intervaloCompetencia } from "./gestao-date-br.ts";
import { competenciaFromDate, type GestaoMetaConfigJson } from "./gestao-meta-calc.ts";
import { mesNomePt, carrosLabel } from "./gestao-posicao-loja.ts";
import { gestaoOperacionalCategoriaLabel } from "./gestao-operacional-categorias.ts";
import { sumComissaoDespesas } from "./gestao-venda-raio-x.ts";
import { syncRecorrenciaLancamentosDb } from "./gestao-recorrencia-db-sync.ts";

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, mar: 3, março: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function shiftGestaoCompetencia(competencia: string, deltaMonths: number): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseGestaoCompetenciaFromText(text: string, now = new Date()): string {
  const t = normalize(text);
  const atual = competenciaFromDate(now);
  if (/\bmes passado\b/.test(t)) return shiftGestaoCompetencia(atual, -1);

  for (const [nome, mes] of Object.entries(MESES)) {
    const re = new RegExp(`\\b${nome}\\b`);
    if (re.test(t)) {
      const yearMatch = t.match(/\b(20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : Number(atual.slice(0, 4));
      return `${year}-${String(mes).padStart(2, "0")}`;
    }
  }
  return atual;
}

export function isGestaoDreWhatsAppRequest(text: string): boolean {
  const t = normalize(text);
  if (/\bdre\b/.test(t)) return true;
  if (/\bdemonstrativo\b/.test(t)) return true;
  if (/\bresultado\s+do\s+mes\b/.test(t)) return true;
  if (/\bdre\s+completo\b/.test(t)) return true;
  return false;
}

export type GestaoDreWhatsappFacts = {
  competencia: string;
  tituloMes: string;
  ateDia: string;
  dre: GestaoDreMes;
  comissaoTotal: number;
  despesasCarrosSemComissao: number;
  operacionaisPorCategoria: Array<{ label: string; valor: number }>;
  metaRealizado: number | null;
  metaAlvo: number | null;
  despesasEstoque: number;
};

type Db = SupabaseClient;

async function loadVendasDreCompetencia(
  sb: Db,
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

export async function loadGestaoDreWhatsappFacts(
  sb: Db,
  userId: string,
  competencia: string,
  now = new Date(),
): Promise<GestaoDreWhatsappFacts> {
  await syncRecorrenciaLancamentosDb(sb as never, userId);
  const vendas = await loadVendasDreCompetencia(sb, userId, competencia);
  const { data: contasRaw } = await sb.from("gestao_conta_lancamento").select(
    "tipo, categoria_operacional, valor, vencimento, pago_em",
  ).eq("user_id", userId).is("deleted_at", null);
  const ops = contasToDreOperacionalRows((contasRaw ?? []).map((c: Record<string, unknown>) => ({
    tipo: c.tipo as string,
    categoria_operacional: String(c.categoria_operacional ?? ""),
    valor: Number(c.valor),
    vencimento: String(c.vencimento ?? ""),
    pago_em: c.pago_em ? String(c.pago_em) : null,
  })));
  const dre = calcDreMes(competencia, vendas, ops);

  let comissaoTotal = 0;
  for (const v of vendas) {
    comissaoTotal += sumComissaoDespesas(
      v.despesas.map((d) => ({ valor: d.valor, categoria: String(d.categoria ?? "") })),
    );
  }
  comissaoTotal = Math.round(comissaoTotal * 100) / 100;
  const despesasCarrosSemComissao = Math.round((dre.despesasCarros - comissaoTotal) * 100) / 100;

  const catMap = new Map<string, number>();
  for (const o of ops) {
    const ref = o.pagoEm ?? o.vencimento;
    if (ref.slice(0, 7) !== competencia) continue;
    const label = gestaoOperacionalCategoriaLabel(o.categoria);
    catMap.set(label, (catMap.get(label) ?? 0) + o.valor);
  }
  const operacionaisPorCategoria = [...catMap.entries()]
    .map(([label, valor]) => ({ label, valor: Math.round(valor * 100) / 100 }))
    .filter((x) => x.valor !== 0)
    .sort((a, b) => b.valor - a.valor);

  const { data: metaRow } = await sb.from("gestao_meta_mensal").select("config_json")
    .eq("user_id", userId).eq("competencia", competencia).is("vendedor_id", null).maybeSingle();
  const metaCfg = metaRow?.config_json as GestaoMetaConfigJson | undefined;
  let metaRealizado: number | null = null;
  let metaAlvo: number | null = null;
  if (metaCfg) {
    metaAlvo = metaCfg.metaValor;
    metaRealizado = metaCfg.tipo === "qtd" ? dre.qtdVendas : dre.faturamento;
  }

  const { data: veiculos } = await sb.from("veiculos_estoque").select("id, status")
    .eq("user_id", userId);
  let despesasEstoque = 0;
  for (const v of veiculos ?? []) {
    if (String(v.status) === "vendido") continue;
    const { data: despesas } = await sb.from("veiculo_despesas").select("valor")
      .eq("user_id", userId).eq("veiculo_id", String(v.id)).is("deleted_at", null);
    despesasEstoque += (despesas ?? []).reduce(
      (a: number, d: { valor: number }) => a + Number(d.valor),
      0,
    );
  }
  despesasEstoque = Math.round(despesasEstoque * 100) / 100;

  const [y, m] = competencia.split("-");
  const tituloMes = `${mesNomePt(competencia).charAt(0).toUpperCase()}${mesNomePt(competencia).slice(1)}/${y}`;
  const hoje = formatYmdSaoPaulo(now);
  const ateDia = competencia === hoje.slice(0, 7)
    ? `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`
    : `${intervaloCompetencia(competencia).end.slice(8, 10)}/${m}`;

  return {
    competencia,
    tituloMes,
    ateDia,
    dre,
    comissaoTotal,
    despesasCarrosSemComissao,
    operacionaisPorCategoria,
    metaRealizado,
    metaAlvo,
    despesasEstoque,
  };
}

function pctBr(n: number, fat: number): string {
  if (fat <= 0) return "—";
  return `${(n / fat * 100).toFixed(1).replace(".", ",")}%`;
}

function lineMoney(label: string, value: number, suffix?: string): string | null {
  if (value === 0) return null;
  const suf = suffix ? `   ${suffix}` : "";
  return `${label.padEnd(36, " ")} ${formatGestaoMoney(value)}${suf}`;
}

export function formatGestaoDreWhatsApp(facts: GestaoDreWhatsappFacts): string {
  const { dre } = facts;
  const fat = dre.faturamento;
  const margemBrutaPct = fat > 0 ? (dre.lucroCarros / fat) * 100 : null;
  const margemLiquidaPct = fat > 0 ? (dre.lucroLiquidoLoja / fat) * 100 : null;

  const lines: string[] = [];
  lines.push(`📊 DRE — ${facts.tituloMes} (até ${facts.ateDia})`);
  lines.push("");

  if (dre.qtdVendas === 0) {
    lines.push("Sem vendas no mês.");
    if (dre.despesasOperacionais > 0) {
      lines.push("");
      lines.push(`Despesas operacionais: ${formatGestaoMoney(dre.despesasOperacionais)}`);
      for (const c of facts.operacionaisPorCategoria) {
        lines.push(`  • ${c.label} ${formatGestaoMoney(c.valor)}`);
      }
    }
    return lines.join("\n");
  }

  const receita = lineMoney(
    `Receita de vendas (${carrosLabel(dre.qtdVendas)})`,
    dre.faturamento,
  );
  if (receita) lines.push(receita);
  const custo = lineMoney("(−) Custo dos carros vendidos", dre.custoCarros);
  if (custo) lines.push(custo);
  const despCar = lineMoney("(−) Despesas dos carros vendidos", dre.despesasCarros);
  if (despCar) {
    lines.push(`${despCar}   (preparação, mecânica, documentação...)`);
  }
  lines.push(
    `= Lucro bruto dos veículos${" ".repeat(11)} ${formatGestaoMoney(dre.lucroCarros)}   (${
      margemBrutaPct != null ? pctBr(dre.lucroCarros, fat) : "—"
    } margem bruta)`,
  );
  lines.push("");

  const com = lineMoney("(−) Comissões", facts.comissaoTotal);
  if (com) lines.push(com);

  const opLine = lineMoney("(−) Despesas operacionais", dre.despesasOperacionais);
  if (opLine) {
    lines.push(opLine);
    if (facts.operacionaisPorCategoria.length) {
      const bullets = facts.operacionaisPorCategoria
        .map((c) => `${c.label} ${formatGestaoMoney(c.valor)}`)
        .join(" • ");
      lines.push(`     • ${bullets}`);
    }
  }

  lines.push(
    `= Lucro líquido${" ".repeat(22)} ${formatGestaoMoney(dre.lucroLiquidoLoja)}   (${
      margemLiquidaPct != null ? pctBr(dre.lucroLiquidoLoja, fat) : "—"
    } margem líquida)`,
  );

  if (facts.metaAlvo != null && facts.metaRealizado != null) {
    const pctMeta = facts.metaAlvo > 0
      ? Math.round((facts.metaRealizado / facts.metaAlvo) * 100)
      : 0;
    lines.push("");
    lines.push(`Meta: ${Math.round(facts.metaRealizado)} de ${facts.metaAlvo} carros (${pctMeta}%)`);
  }

  if (facts.despesasEstoque > 0) {
    lines.push(
      `Despesas em carros ainda em estoque: ${formatGestaoMoney(facts.despesasEstoque)} (entram no custo quando venderem)`,
    );
  }

  lines.push("📄 PDF completo: Painel → Gestão → Resultado → Relatório do mês");

  return lines.join("\n");
}

/** Margens explícitas para testes e snapshot (bruta = lucro carros; líquida = lucro loja). */
export function dreMargensPct(dre: GestaoDreMes): {
  margem_bruta_pct: number | null;
  margem_liquida_pct: number | null;
} {
  const fat = dre.faturamento;
  return {
    margem_bruta_pct: fat > 0 ? Math.round((dre.lucroCarros / fat) * 1000) / 10 : null,
    margem_liquida_pct: fat > 0
      ? Math.round((dre.lucroLiquidoLoja / fat) * 1000) / 10
      : null,
  };
}
