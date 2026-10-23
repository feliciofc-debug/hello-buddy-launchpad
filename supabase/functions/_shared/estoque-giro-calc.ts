import {
  calcGestaoComissao,
  type GestaoComissaoRegraJson,
} from "./gestao-comissao-calc.ts";
import {
  resolverIpvaVeiculo,
  type GiroIpvaVeiculoAjuste,
} from "./estoque-giro-ipva.ts";

export type EstoqueGiroFaixa = "saudavel" | "atencao" | "risco" | "decisao";
export type EstoqueGiroFonte = "fipe" | "manual" | "molicar_b2c" | "molicar_b2b" | "molicar_c2b";

export type EstoqueGiroConfig = {
  faixaAtencaoDias: number;
  faixaRiscoDias: number;
  faixaDecisaoDias: number;
  custoFinanceiroMensalPct: number | null;
  desvalorizacaoMensalPct: number | null;
  repasseDescontoFipePct: number | null;
  uf: string | null;
  ipvaAliquotaPct: number | null;
  ipvaAliquotaHibridoPct: number | null;
  ipvaAliquotaEletricoPct: number | null;
  ipvaLojaPagaVirada: boolean;
};

export const DEFAULT_ESTOQUE_GIRO_CONFIG: EstoqueGiroConfig = {
  faixaAtencaoDias: 30,
  faixaRiscoDias: 60,
  faixaDecisaoDias: 90,
  custoFinanceiroMensalPct: null,
  desvalorizacaoMensalPct: null,
  repasseDescontoFipePct: null,
  uf: null,
  ipvaAliquotaPct: null,
  ipvaAliquotaHibridoPct: null,
  ipvaAliquotaEletricoPct: null,
  ipvaLojaPagaVirada: false,
};

export type EstoqueGiroReferencia = {
  fonte: EstoqueGiroFonte;
  valor: number;
  capturadoEm?: string | null;
};

export type EstoqueGiroInput = {
  hoje: string | Date;
  dataCompra: string | null;
  createdAt: string;
  valorCompra: number | null;
  despesas: number[];
  precoAnunciado: number | null;
  referencias: EstoqueGiroReferencia[];
  config: EstoqueGiroConfig;
  regraComissao: GestaoComissaoRegraJson;
  leadsUltimos30Dias?: number | null;
  combustivel?: string | null;
  versao?: string | null;
  modelo?: string | null;
  ipvaAjuste?: GiroIpvaVeiculoAjuste | null;
};

export type EstoqueGiroResultado = {
  diasEmEstoque: number;
  faixa: EstoqueGiroFaixa;
  dadosIncompletos: string[];
  custoAtual: number | null;
  custoFinanceiroAcumulado: number | null;
  comissaoEstimada: number | null;
  margemVarejoHoje: number | null;
  referenciaRepasse: EstoqueGiroReferencia | null;
  valorRepasseHoje: number | null;
  margemRepasseHoje: number | null;
  margemVarejo30d: number | null;
  margemRepasse30d: number | null;
  ipvaProjetado: number | null;
  ipvaViradaValor: number | null;
  ipvaViradaDiasRestantes: number | null;
  ipvaBaseFonte: "fipe" | "preco_anunciado" | null;
  ipvaAliquotaEfetivaPct: number | null;
  ipvaAliquotaRotulo: string | null;
  ipvaConferirDocumento: boolean;
  custoDeEsperar30d: number | null;
  indiceRisco: number;
  indiceSemDado: string[];
  recomendacao: string;
  porque: string;
  precoSugerido7d: number | null;
  passos: Array<{ rotulo: string; valor: number | null; formula: string }>;
};

const roundMoney = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const roundDownTo100 = (n: number) => Math.floor(n / 100) * 100;

function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  return new Date(normalized);
}

export function diasEmEstoque(
  hoje: string | Date,
  dataCompra: string | null,
  createdAt: string,
): number {
  const end = parseDateOnly(hoje);
  const start = parseDateOnly(dataCompra || createdAt);
  if (!Number.isFinite(end.getTime()) || !Number.isFinite(start.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function faixaEstoqueGiro(
  dias: number,
  config: EstoqueGiroConfig,
): EstoqueGiroFaixa {
  if (dias < config.faixaAtencaoDias) return "saudavel";
  if (dias < config.faixaRiscoDias) return "atencao";
  if (dias < config.faixaDecisaoDias) return "risco";
  return "decisao";
}

export function escolherReferenciaRepasse(
  referencias: EstoqueGiroReferencia[],
): EstoqueGiroReferencia | null {
  const latest = (fonte: EstoqueGiroFonte) =>
    referencias
      .filter((r) => r.fonte === fonte && r.valor > 0)
      .sort((a, b) => String(b.capturadoEm ?? "").localeCompare(String(a.capturadoEm ?? "")))[0] ?? null;
  return latest("molicar_b2b") ?? latest("manual") ?? latest("fipe");
}

export function baseIpvaEstoqueGiro(
  referencias: EstoqueGiroReferencia[],
  precoAnunciado: number | null,
): { valor: number | null; fonte: "fipe" | "preco_anunciado" | null } {
  const fipe = referencias
    .filter((r) => r.fonte === "fipe" && r.valor > 0)
    .sort((a, b) => String(b.capturadoEm ?? "").localeCompare(String(a.capturadoEm ?? "")))[0] ?? null;
  if (fipe) return { valor: fipe.valor, fonte: "fipe" };
  if (precoAnunciado != null && precoAnunciado > 0) {
    return { valor: precoAnunciado, fonte: "preco_anunciado" };
  }
  return { valor: null, fonte: null };
}

function repasseMelhorQueEsperar(
  margemRepasseHoje: number | null,
  margemVarejo30d: number | null,
): boolean {
  return margemRepasseHoje != null &&
    margemVarejo30d != null &&
    margemRepasseHoje > margemVarejo30d;
}

function formatMargensRepasseVsEsperar(
  margemRepasseHoje: number | null,
  margemVarejo30d: number | null,
): string {
  const repasse = margemRepasseHoje == null
    ? "—"
    : margemRepasseHoje.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esperar = margemVarejo30d == null
    ? "—"
    : margemVarejo30d.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `Repasse hoje: ${repasse} | Esperar 30 dias: ${esperar}`;
}

function crossesNewYear(hoje: Date): boolean {
  const future = new Date(hoje.getTime());
  future.setUTCDate(future.getUTCDate() + 30);
  return future.getUTCFullYear() > hoje.getUTCFullYear();
}

function ymdToParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

export function isTemporadaIpvaVirada(hoje: string | Date): boolean {
  const ymd = typeof hoje === "string" ? hoje : ymdFromDate(hoje);
  return ymdToParts(ymd).m >= 10;
}

function ymdFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function diasAteViradaAno(hoje: string | Date): number {
  const ymd = typeof hoje === "string" ? hoje : ymdFromDate(hoje);
  const { y } = ymdToParts(ymd);
  const virada = parseDateOnly(`${y + 1}-01-01`);
  const start = parseDateOnly(ymd);
  return Math.max(0, Math.floor((virada.getTime() - start.getTime()) / 86_400_000));
}

function weightedRisk(parts: Array<{ score: number; weight: number; available: boolean }>): number {
  const available = parts.filter((p) => p.available);
  const weight = available.reduce((sum, p) => sum + p.weight, 0);
  if (weight <= 0) return 0;
  return Math.round(
    available.reduce((sum, p) => sum + clamp01(p.score) * p.weight, 0) / weight * 100,
  );
}

function calcIpvaVirada(
  hoje: string | Date,
  config: EstoqueGiroConfig,
  baseIpva: number | null,
  aliquotaPct: number | null,
): { valor: number | null; diasRestantes: number | null } {
  if (!config.ipvaLojaPagaVirada || aliquotaPct == null || baseIpva == null) {
    return { valor: null, diasRestantes: null };
  }
  if (aliquotaPct <= 0) return { valor: null, diasRestantes: null };
  if (!isTemporadaIpvaVirada(hoje)) return { valor: null, diasRestantes: null };
  const diasRestantes = diasAteViradaAno(hoje);
  return {
    valor: roundMoney(baseIpva * aliquotaPct / 100),
    diasRestantes,
  };
}

function ipvaRiscoScore(
  hoje: string | Date,
  ipvaVirada: number,
  baseIpva: number,
  ipvaProjetado30d: number,
): number {
  if (baseIpva <= 0) return 0;
  if (isTemporadaIpvaVirada(hoje)) {
    const ymd = typeof hoje === "string" ? hoje : ymdFromDate(hoje);
    const { y } = ymdToParts(ymd);
    const diasTotal = diasAteViradaAno(`${y}-10-01`);
    const diasRestantes = diasAteViradaAno(hoje);
    const progress = diasTotal > 0 ? 1 - diasRestantes / diasTotal : 1;
    return clamp01(ipvaVirada / baseIpva * 10 * progress);
  }
  if (ipvaProjetado30d > 0) return clamp01(ipvaProjetado30d / baseIpva * 10);
  return 0;
}

export function calcularEstoqueGiro(input: EstoqueGiroInput): EstoqueGiroResultado {
  const { config } = input;
  const dias = diasEmEstoque(input.hoje, input.dataCompra, input.createdAt);
  const faixa = faixaEstoqueGiro(dias, config);
  const incompletos: string[] = [];
  if (input.valorCompra == null || input.valorCompra <= 0) incompletos.push("custo de compra");
  if (input.precoAnunciado == null || input.precoAnunciado <= 0) incompletos.push("preço anunciado");

  const referencia = escolherReferenciaRepasse(input.referencias);

  const despesas = input.despesas.reduce(
    (sum, valor) => sum + (Number.isFinite(valor) ? Math.max(0, valor) : 0),
    0,
  );
  const custoFinanceiroAcumulado = input.valorCompra != null &&
      config.custoFinanceiroMensalPct != null
    ? input.valorCompra * config.custoFinanceiroMensalPct / 100 * dias / 30
    : null;
  const custoAtual = input.valorCompra != null
    ? roundMoney(input.valorCompra + despesas + (custoFinanceiroAcumulado ?? 0))
    : null;

  const lucroAntesComissao = custoAtual != null && input.precoAnunciado != null
    ? input.precoAnunciado - custoAtual
    : null;
  const margemAntesComissao = lucroAntesComissao != null && input.precoAnunciado! > 0
    ? lucroAntesComissao / input.precoAnunciado! * 100
    : null;
  const comissao = input.precoAnunciado != null && input.precoAnunciado > 0
    ? calcGestaoComissao({
      valorVenda: input.precoAnunciado,
      lucroLiquido: lucroAntesComissao,
      margemPct: margemAntesComissao,
      regra: input.regraComissao,
    }).total
    : null;
  const margemVarejoHoje = custoAtual != null && input.precoAnunciado != null
    ? roundMoney(input.precoAnunciado - custoAtual - (comissao ?? 0))
    : null;

  let valorRepasseHoje: number | null = null;
  if (referencia?.fonte === "molicar_b2b" || referencia?.fonte === "manual") {
    valorRepasseHoje = roundMoney(referencia.valor);
  } else if (referencia?.fonte === "fipe" && config.repasseDescontoFipePct != null) {
    valorRepasseHoje = roundMoney(
      referencia.valor * (1 - config.repasseDescontoFipePct / 100),
    );
  }
  const margemRepasseHoje = valorRepasseHoje != null && custoAtual != null
    ? roundMoney(valorRepasseHoje - custoAtual)
    : null;

  const custoFinanceiro30 = input.valorCompra != null &&
      config.custoFinanceiroMensalPct != null
    ? input.valorCompra * config.custoFinanceiroMensalPct / 100
    : 0;
  const fatorDesvalorizacao = config.desvalorizacaoMensalPct != null
    ? 1 - config.desvalorizacaoMensalPct / 100
    : 1;
  const hoje = parseDateOnly(input.hoje);
  const hojeYmd = typeof input.hoje === "string" ? input.hoje : ymdFromDate(hoje);
  const ipvaBase = baseIpvaEstoqueGiro(input.referencias, input.precoAnunciado);
  const baseIpva = ipvaBase.valor;
  const ipvaResolvido = resolverIpvaVeiculo({
    ajuste: input.ipvaAjuste,
    combustivel: input.combustivel ?? null,
    versao: input.versao ?? null,
    modelo: input.modelo ?? null,
    config,
  });
  const aliquotaIpva = ipvaResolvido.aliquotaPct;
  const ipvaVirada = calcIpvaVirada(hojeYmd, config, baseIpva, aliquotaIpva);
  const ipvaProjetado = config.ipvaLojaPagaVirada &&
      aliquotaIpva != null &&
      aliquotaIpva > 0 &&
      baseIpva != null &&
      crossesNewYear(hoje)
    ? roundMoney(baseIpva * aliquotaIpva / 100)
    : 0;
  const custo30 = custoAtual != null
    ? custoAtual + custoFinanceiro30 + ipvaProjetado
    : null;
  const preco30 = input.precoAnunciado != null
    ? input.precoAnunciado * fatorDesvalorizacao
    : null;
  const comissao30 = preco30 != null
    ? calcGestaoComissao({
      valorVenda: preco30,
      lucroLiquido: custo30 != null ? preco30 - custo30 : null,
      margemPct: custo30 != null && preco30 > 0 ? (preco30 - custo30) / preco30 * 100 : null,
      regra: input.regraComissao,
    }).total
    : null;
  const margemVarejo30d = custo30 != null && preco30 != null
    ? roundMoney(preco30 - custo30 - (comissao30 ?? 0))
    : null;
  const repasse30 = valorRepasseHoje != null ? valorRepasseHoje * fatorDesvalorizacao : null;
  const margemRepasse30d = custo30 != null && repasse30 != null
    ? roundMoney(repasse30 - custo30)
    : null;
  const custoDeEsperar30d = margemVarejoHoje != null && margemVarejo30d != null
    ? roundMoney(margemVarejoHoje - margemVarejo30d)
    : null;

  const semDado: string[] = [];
  if (config.desvalorizacaoMensalPct == null) semDado.push("desvalorização");
  if (input.leadsUltimos30Dias == null) semDado.push("procura/leads");
  if ((config.ipvaAliquotaPct == null && aliquotaIpva == null) || !config.uf) {
    semDado.push("IPVA/UF");
  }
  const compression = margemVarejoHoje != null && custoDeEsperar30d != null
    ? custoDeEsperar30d / Math.max(1, Math.abs(margemVarejoHoje))
    : 0;
  const risco = weightedRisk([
    { score: dias / Math.max(1, config.faixaDecisaoDias), weight: 30, available: true },
    { score: compression, weight: 25, available: margemVarejoHoje != null && custoDeEsperar30d != null },
    {
      score: (config.desvalorizacaoMensalPct ?? 0) / 3,
      weight: 20,
      available: config.desvalorizacaoMensalPct != null,
    },
    {
      score: input.leadsUltimos30Dias === 0 ? 1 : input.leadsUltimos30Dias != null ? 1 / (1 + input.leadsUltimos30Dias) : 0,
      weight: 15,
      available: input.leadsUltimos30Dias != null,
    },
    {
      score: ipvaRiscoScore(
        hojeYmd,
        ipvaVirada.valor ?? 0,
        baseIpva ?? 0,
        ipvaProjetado,
      ),
      weight: 10,
      available: aliquotaIpva != null && !!config.uf && baseIpva != null && aliquotaIpva > 0,
    },
  ]);

  const pisoPreco = custoAtual != null && comissao != null
    ? roundMoney(custoAtual + comissao)
    : null;
  let precoSugerido7d: number | null = null;
  let precoSugeridoAbaixoPiso = false;
  if (
    faixa === "risco" &&
    input.precoAnunciado != null &&
    custoDeEsperar30d != null
  ) {
    const bruto = input.precoAnunciado - custoDeEsperar30d;
    const arredondado = roundDownTo100(bruto);
    if (pisoPreco != null && arredondado < pisoPreco) {
      precoSugeridoAbaixoPiso = true;
    } else {
      precoSugerido7d = roundMoney(arredondado);
    }
  }

  const faixaPermiteRepasse = faixa === "risco" || faixa === "decisao";
  let recomendacao = "Manter e acompanhar";
  if (faixa === "atencao") recomendacao = "Revisar preço e anúncio";
  if (faixa === "risco") {
    if (precoSugeridoAbaixoPiso) {
      if (repasseMelhorQueEsperar(margemRepasseHoje, margemVarejo30d)) {
        recomendacao = "Priorizar repasse";
      } else {
        recomendacao = "Decidir com o dono";
      }
    } else if (precoSugerido7d != null) {
      recomendacao = `Reduzir para R$ ${precoSugerido7d.toLocaleString("pt-BR")} por 7 dias`;
    } else {
      recomendacao = "Revisar preço por 7 dias";
    }
  }
  if (faixa === "decisao") recomendacao = "Priorizar decisão de repasse";
  if (faixaPermiteRepasse && !precoSugeridoAbaixoPiso &&
    repasseMelhorQueEsperar(margemRepasseHoje, margemVarejo30d)) {
    recomendacao = "Priorizar repasse";
  }
  if (incompletos.length) recomendacao = "Completar dados antes de decidir";

  let porque = incompletos.length
    ? `Faltam ${incompletos.join(", ")}; não é seguro projetar sem esses valores.`
    : `Hoje a margem estimada é R$ ${(margemVarejoHoje ?? 0).toLocaleString("pt-BR")} e esperar 30 dias pode consumir R$ ${(custoDeEsperar30d ?? 0).toLocaleString("pt-BR")}.`;
  if (
    !incompletos.length &&
    precoSugeridoAbaixoPiso &&
    input.precoAnunciado != null &&
    custoDeEsperar30d != null &&
    pisoPreco != null
  ) {
    const tentativa = roundDownTo100(input.precoAnunciado - custoDeEsperar30d);
    const pisoTxt =
      `Preço atual R$ ${input.precoAnunciado.toLocaleString("pt-BR")} − custo de esperar R$ ${custoDeEsperar30d.toLocaleString("pt-BR")} = R$ ${tentativa.toLocaleString("pt-BR")}, abaixo do piso de custo + comissão (R$ ${pisoPreco.toLocaleString("pt-BR")}).`;
    porque = repasseMelhorQueEsperar(margemRepasseHoje, margemVarejo30d)
      ? `${pisoTxt} Repasse hoje supera a margem projetada em 30 dias.`
      : `${pisoTxt} ${formatMargensRepasseVsEsperar(margemRepasseHoje, margemVarejo30d)}.`;
  } else if (!incompletos.length && precoSugerido7d != null && input.precoAnunciado != null && custoDeEsperar30d != null) {
    porque =
      `Preço R$ ${input.precoAnunciado.toLocaleString("pt-BR")} − custo de esperar 30d R$ ${custoDeEsperar30d.toLocaleString("pt-BR")}, arredondado para baixo em R$ 100 → R$ ${precoSugerido7d.toLocaleString("pt-BR")}.`;
  }

  return {
    diasEmEstoque: dias,
    faixa,
    dadosIncompletos: incompletos,
    custoAtual,
    custoFinanceiroAcumulado: custoFinanceiroAcumulado == null ? null : roundMoney(custoFinanceiroAcumulado),
    comissaoEstimada: comissao,
    margemVarejoHoje,
    referenciaRepasse: referencia,
    valorRepasseHoje,
    margemRepasseHoje,
    margemVarejo30d,
    margemRepasse30d,
    ipvaProjetado: roundMoney(ipvaProjetado),
    ipvaViradaValor: ipvaVirada.valor,
    ipvaViradaDiasRestantes: ipvaVirada.diasRestantes,
    ipvaBaseFonte: ipvaBase.fonte,
    ipvaAliquotaEfetivaPct: aliquotaIpva,
    ipvaAliquotaRotulo: ipvaResolvido.rotulo,
    ipvaConferirDocumento: ipvaResolvido.conferirDocumento,
    custoDeEsperar30d,
    indiceRisco: risco,
    indiceSemDado: semDado,
    recomendacao,
    porque,
    precoSugerido7d,
    passos: [
      { rotulo: "Compra", valor: input.valorCompra, formula: "Valor registrado em veiculo_compra" },
      { rotulo: "Despesas", valor: roundMoney(despesas), formula: "Soma das despesas ativas" },
      { rotulo: "Custo financeiro acumulado", valor: custoFinanceiroAcumulado == null ? null : roundMoney(custoFinanceiroAcumulado), formula: "Compra × taxa mensal × dias ÷ 30" },
      { rotulo: "Custo atual", valor: custoAtual, formula: "Compra + despesas + custo financeiro" },
      { rotulo: "Comissão estimada", valor: comissao, formula: "Regra de comissão da loja" },
      { rotulo: "Margem varejo hoje", valor: margemVarejoHoje, formula: "Preço − custo atual − comissão" },
      {
        rotulo: "Base IPVA",
        valor: baseIpva,
        formula: ipvaBase.fonte === "fipe"
          ? "Snapshot FIPE mais recente × alíquota"
          : ipvaBase.fonte === "preco_anunciado"
          ? "Base: preço anunciado (sem FIPE) × alíquota"
          : "Sem base para IPVA",
      },
      {
        rotulo: "IPVA na virada (exibição)",
        valor: ipvaVirada.valor,
        formula: aliquotaIpva != null
          ? `Base IPVA × alíquota ${ipvaResolvido.rotulo} (${aliquotaIpva}%), visível de outubro até a virada`
          : "Base IPVA × alíquota, visível de outubro até a virada",
      },
      { rotulo: "IPVA projetado (30 dias)", valor: roundMoney(ipvaProjetado), formula: "Entra no custo futuro só se a virada ocorrer em 30 dias" },
      { rotulo: "Margem varejo em 30 dias", valor: margemVarejo30d, formula: "Preço desvalorizado − custo futuro − comissão" },
      { rotulo: "Custo de esperar 30 dias", valor: custoDeEsperar30d, formula: "Margem hoje − margem projetada" },
      { rotulo: "Preço sugerido (7 dias)", valor: precoSugerido7d, formula: "Preço − custo de esperar 30d, piso = custo + comissão" },
    ],
  };
}
