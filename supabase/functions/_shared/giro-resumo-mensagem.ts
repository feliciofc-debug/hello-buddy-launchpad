import type { EstoqueGiroFaixa, EstoqueGiroResultado } from "./estoque-giro-calc.ts";
import { isTemporadaIpvaVirada } from "./estoque-giro-calc.ts";

export type GiroResumoVeiculoLinha = {
  label: string;
  dias: number;
  faixa: EstoqueGiroFaixa;
  resultado: EstoqueGiroResultado;
  custoFinanceiroDiario?: number | null;
};

export type GiroResumoAgregado = {
  total: number;
  faixas: Record<EstoqueGiroFaixa, number>;
  custoFinanceiroHoje: number | null;
  riscoProjetado30d: number | null;
  ipvaViradaEstoque: number | null;
  ipvaDiasRestantes: number | null;
  semCustoCompra: number;
  semPrecoAnunciado: number;
  consignados: number;
  consignadosVencendo15d: number;
  destaques: GiroResumoVeiculoLinha[];
};

const faixaEmoji: Record<EstoqueGiroFaixa, string> = {
  saudavel: "🟢",
  atencao: "🟡",
  risco: "🟠",
  decisao: "🔴",
};

export function formatMoneyBr(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDataResumoBr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Variável de template Meta: uma linha, sem \\n \\t nem 4+ espaços. */
export function sanitizarVariavelTemplateMeta(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function formatNumeroTemplate(value: number | null): string {
  if (value == null) return "—";
  return sanitizarVariavelTemplateMeta(
    value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  );
}

export function montarVariaveisTemplateGiroResumo(
  agregado: GiroResumoAgregado,
  hojeYmd: string,
): [string, string, string, string, string] {
  const atencao = agregado.faixas.atencao + agregado.faixas.risco + agregado.faixas.decisao;
  return [
    sanitizarVariavelTemplateMeta(formatDataResumoBr(hojeYmd)),
    sanitizarVariavelTemplateMeta(String(agregado.total)),
    sanitizarVariavelTemplateMeta(String(atencao)),
    formatNumeroTemplate(agregado.custoFinanceiroHoje),
    formatNumeroTemplate(agregado.riscoProjetado30d),
  ];
}

export const GESTAO_GIRO_RESUMO_TEMPLATE_CORPO =
  "📊 Resumo do estoque de {{1}}: {{2}} carros, {{3}} exigem atenção. O estoque parado custou R$ {{4}} hoje e o risco projetado em 30 dias é de R$ {{5}}. Veja os detalhes no painel da Gestão.";

export function agregarGiroResumo(
  items: GiroResumoVeiculoLinha[],
  hojeYmd: string,
): GiroResumoAgregado {
  const faixas: Record<EstoqueGiroFaixa, number> = {
    saudavel: 0,
    atencao: 0,
    risco: 0,
    decisao: 0,
  };
  let custoFinanceiroHoje = 0;
  let hasCustoFinanceiro = false;
  let riscoProjetado30d = 0;
  let hasRisco = false;
  let ipvaViradaEstoque = 0;
  let hasIpva = false;
  let ipvaDiasRestantes: number | null = null;
  let semCustoCompra = 0;
  let semPrecoAnunciado = 0;
  let consignados = 0;
  let consignadosVencendo15d = 0;

  for (const item of items) {
    faixas[item.faixa] += 1;
    const r = item.resultado;
    if (r.consignado) {
      consignados += 1;
      if (
        r.contratoDiasRestantes != null &&
        r.contratoDiasRestantes <= 15
      ) consignadosVencendo15d += 1;
    }
    if (r.dadosIncompletos.includes("custo de compra")) semCustoCompra += 1;
    if (r.dadosIncompletos.includes("preço anunciado")) semPrecoAnunciado += 1;
    if (item.custoFinanceiroDiario != null && item.custoFinanceiroDiario > 0) {
      custoFinanceiroHoje += item.custoFinanceiroDiario;
      hasCustoFinanceiro = true;
    }
    if (r.custoDeEsperar30d != null) {
      riscoProjetado30d += Math.max(0, r.custoDeEsperar30d);
      hasRisco = true;
    }
    if (r.ipvaViradaValor != null && r.ipvaViradaValor > 0) {
      ipvaViradaEstoque += r.ipvaViradaValor;
      hasIpva = true;
      if (r.ipvaViradaDiasRestantes != null) {
        ipvaDiasRestantes = r.ipvaViradaDiasRestantes;
      }
    }
  }

  const destaques = [...items]
    .filter((i) => i.faixa === "atencao" || i.faixa === "risco" || i.faixa === "decisao")
    .sort((a, b) => b.resultado.indiceRisco - a.resultado.indiceRisco)
    .slice(0, 3);

  return {
    total: items.length,
    faixas,
    custoFinanceiroHoje: hasCustoFinanceiro ? Math.round(custoFinanceiroHoje * 100) / 100 : null,
    riscoProjetado30d: hasRisco ? Math.round(riscoProjetado30d * 100) / 100 : null,
    ipvaViradaEstoque: hasIpva && isTemporadaIpvaVirada(hojeYmd)
      ? Math.round(ipvaViradaEstoque * 100) / 100
      : null,
    ipvaDiasRestantes,
    semCustoCompra,
    semPrecoAnunciado,
    consignados,
    consignadosVencendo15d,
    destaques,
  };
}

export function montarMensagemGiroResumo(
  agregado: GiroResumoAgregado,
  hojeYmd: string,
  linkPainel = "https://www.amzofertas.com.br/gestao/lucro?aba=giro",
): string {
  const linhas: string[] = [];
  linhas.push(`📊 *Resumo do estoque, ${formatDataResumoBr(hojeYmd)}*`);
  linhas.push(
    `${agregado.total} carros · 🟢 ${agregado.faixas.saudavel} · 🟡 ${agregado.faixas.atencao} · 🟠 ${agregado.faixas.risco} · 🔴 ${agregado.faixas.decisao}`,
  );
  if (agregado.custoFinanceiroHoje != null) {
    linhas.push(`💸 Dinheiro próprio parado custou ${formatMoneyBr(agregado.custoFinanceiroHoje)} hoje (juros)`);
  }
  if (agregado.riscoProjetado30d != null) {
    linhas.push(`⚠️ Risco projetado em 30 dias: ${formatMoneyBr(agregado.riscoProjetado30d)}`);
  }
  if (agregado.ipvaViradaEstoque != null) {
    const dias = agregado.ipvaDiasRestantes ?? "—";
    linhas.push(`🧾 IPVA da virada: ${formatMoneyBr(agregado.ipvaViradaEstoque)} (faltam ${dias} dias)`);
  }
  if (agregado.consignados > 0) {
    linhas.push(
      `🤝 Consignados: ${agregado.consignados} carros, ${agregado.consignadosVencendo15d} com contrato vencendo em 15 dias`,
    );
  }
  if (agregado.destaques.length) {
    linhas.push("");
    linhas.push("*Exigem atenção:*");
    linhas.push("");
    for (const d of agregado.destaques) {
      linhas.push(`${d.label}, ${d.dias} dias: ${d.resultado.recomendacao}`);
    }
  }
  const incompletos: string[] = [];
  if (agregado.semCustoCompra > 0) {
    incompletos.push(
      `${agregado.semCustoCompra} carro${agregado.semCustoCompra > 1 ? "s" : ""} sem custo de compra`,
    );
  }
  if (agregado.semPrecoAnunciado > 0) {
    incompletos.push(
      `${agregado.semPrecoAnunciado} carro${agregado.semPrecoAnunciado > 1 ? "s" : ""} sem preço anunciado`,
    );
  }
  if (incompletos.length) {
    linhas.push("");
    linhas.push(incompletos.join("; ") + ".");
  }
  linhas.push("");
  linhas.push(`Ver tudo: ${linkPainel}`);
  const msg = linhas.join("\n");
  const lineCount = msg.split("\n").length;
  if (lineCount > 12 && agregado.destaques.length > 1) {
    return montarMensagemGiroResumo({
      ...agregado,
      destaques: agregado.destaques.slice(0, 2),
    }, hojeYmd, linkPainel);
  }
  return msg;
}

export function resumoJaEnviadoHoje(
  resumoUltimoEnvio: string | null,
  hojeYmd: string,
): boolean {
  return resumoUltimoEnvio === hojeYmd;
}

export function horaResumoAtingida(
  horaConfig: string,
  now: Date,
): boolean {
  const { hour, minute } = hourMinuteFromDate(now);
  const [h, m] = horaConfig.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  return hour > h || (hour === h && minute >= m);
}

function hourMinuteFromDate(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? 0),
  };
}
