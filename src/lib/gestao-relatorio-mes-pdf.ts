import { jsPDF } from "jspdf";
import { calcDreMes, type GestaoDreMes } from "../../supabase/functions/_shared/gestao-dre-calc.ts";
import { gestaoOperacionalCategoriaLabel } from "../../supabase/functions/_shared/gestao-operacional-categorias.ts";
import { formatGestaoMoney, formatGestaoPct } from "./gestao-format.ts";
import type { GestaoContaLancamento } from "./gestao-financeiro-load.ts";
import { contasToDreOperacional, veiculosToDreVendas } from "./gestao-financeiro-load.ts";
import type { GestaoVeiculoEnriched } from "./gestao-lucro-types.ts";
import { isGestaoVeiculoVendido } from "./gestao-venda-display.ts";

export type GestaoRelatorioConciliacaoResumo = {
  conciliadas: number;
  pendentes: number;
};

export type GestaoRelatorioMesInput = {
  competencia: string;
  nomeEmpresa: string;
  veiculos: GestaoVeiculoEnriched[];
  contas: GestaoContaLancamento[];
  conciliacao?: GestaoRelatorioConciliacaoResumo;
};

const FOOTER =
  "Documento gerencial — a apuração fiscal deve ser validada pelo contador.";
const MARGIN = 14;
const PAGE_H = 297;
const FOOTER_Y = PAGE_H - 10;

function competenciaAnterior(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function fmtCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-");
  return `${m}/${y}`;
}

function origemDespesaLabel(origem: string): string {
  if (origem.startsWith("whatsapp")) return "WhatsApp";
  if (origem === "painel") return "Painel";
  return origem;
}

class RelatorioPdf {
  doc: jsPDF;
  y = MARGIN;
  page = 1;
  totalPages = 1;

  constructor() {
    this.doc = new jsPDF();
    this.doc.setFontSize(10);
  }

  private footer() {
    this.doc.setFontSize(8);
    this.doc.text(FOOTER, MARGIN, FOOTER_Y, { maxWidth: 180 });
    this.doc.text(`página ${this.page} de ${this.totalPages}`, 200, FOOTER_Y, { align: "right" });
    this.doc.setFontSize(10);
  }

  private ensure(h: number) {
    if (this.y + h > FOOTER_Y - 8) {
      this.doc.addPage();
      this.page += 1;
      this.y = MARGIN;
    }
  }

  title(text: string) {
    this.ensure(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text(text, MARGIN, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.y += 8;
  }

  line(text: string, indent = 0) {
    this.ensure(6);
    this.doc.text(text, MARGIN + indent, this.y, { maxWidth: 182 - indent });
    this.y += 5;
  }

  blank(n = 4) {
    this.y += n;
  }

  tableHeader(cols: string[], widths: number[]) {
    this.ensure(8);
    let x = MARGIN;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    cols.forEach((c, i) => {
      this.doc.text(c, x, this.y);
      x += widths[i]!;
    });
    this.doc.setFont("helvetica", "normal");
    this.y += 5;
  }

  tableRow(cells: string[], widths: number[]) {
    this.ensure(6);
    let x = MARGIN;
    this.doc.setFontSize(7);
    cells.forEach((c, i) => {
      this.doc.text(c.slice(0, 28), x, this.y);
      x += widths[i]!;
    });
    this.y += 4;
  }

  finalizePages() {
    this.totalPages = this.doc.getNumberOfPages();
    for (let p = 1; p <= this.totalPages; p++) {
      this.doc.setPage(p);
      this.page = p;
      this.footer();
    }
  }

  save(filename: string) {
    this.finalizePages();
    this.doc.save(filename);
  }
}

function dreRows(dre: GestaoDreMes, drePrev: GestaoDreMes | null) {
  const fat = dre.faturamento || 1;
  const pct = (v: number) => (dre.faturamento > 0 ? `${((v / fat) * 100).toFixed(1)}%` : "—");
  const prev = (v: (d: GestaoDreMes) => number) =>
    drePrev ? formatGestaoMoney(v(drePrev)) : "—";
  return [
    ["Faturamento", formatGestaoMoney(dre.faturamento), dre.faturamento > 0 ? "100%" : "—", prev((d) => d.faturamento)],
    ["Custo carros vendidos", formatGestaoMoney(dre.custoCarros), pct(dre.custoCarros), prev((d) => d.custoCarros)],
    ["Despesas dos carros", formatGestaoMoney(dre.despesasCarros), pct(dre.despesasCarros), prev((d) => d.despesasCarros)],
    ["Lucro dos carros", formatGestaoMoney(dre.lucroCarros), pct(dre.lucroCarros), prev((d) => d.lucroCarros)],
    ["Despesas operacionais", formatGestaoMoney(dre.despesasOperacionais), pct(dre.despesasOperacionais), prev((d) => d.despesasOperacionais)],
    ["Lucro líquido da loja", formatGestaoMoney(dre.lucroLiquidoLoja), pct(dre.lucroLiquidoLoja), prev((d) => d.lucroLiquidoLoja)],
  ];
}

export function downloadRelatorioMesPdf(input: GestaoRelatorioMesInput, filename: string) {
  const { competencia, nomeEmpresa, veiculos, contas, conciliacao } = input;
  const vendasDre = veiculosToDreVendas(veiculos);
  const opsDre = contasToDreOperacional(contas);
  const dre = calcDreMes(competencia, vendasDre, opsDre);
  const drePrev = calcDreMes(competenciaAnterior(competencia), vendasDre, opsDre);
  const gerado = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const pdf = new RelatorioPdf();
  pdf.doc.setFontSize(18);
  pdf.doc.text(nomeEmpresa || "Loja", MARGIN, pdf.y);
  pdf.y += 10;
  pdf.doc.setFontSize(14);
  pdf.doc.text(`Relatório gerencial — ${fmtCompetencia(competencia)}`, MARGIN, pdf.y);
  pdf.y += 8;
  pdf.doc.setFontSize(10);
  pdf.doc.text(`Gerado em: ${gerado}`, MARGIN, pdf.y);
  pdf.y += 12;

  pdf.title("DRE — Demonstrativo do resultado");
  pdf.tableHeader(["Linha", "Valor", "% fat.", "Mês anterior"], [70, 40, 28, 40]);
  for (const row of dreRows(dre, drePrev)) {
    pdf.tableRow(row, [70, 40, 28, 40]);
  }
  pdf.blank();

  const lucroMedioCarro = dre.qtdVendas > 0 ? dre.lucroCarros / dre.qtdVendas : 0;
  const breakEven =
    lucroMedioCarro > 0 ? Math.ceil(dre.despesasOperacionais / lucroMedioCarro) : null;
  pdf.line(
    breakEven != null
      ? `Ponto de equilíbrio: ~${breakEven} carros/mês para cobrir despesas operacionais (lucro médio/carro: ${formatGestaoMoney(lucroMedioCarro)}). Vendidos no mês: ${dre.qtdVendas}.`
      : `Ponto de equilíbrio: vendas ou lucro por carro insuficientes para calcular. Vendidos: ${dre.qtdVendas}.`,
  );
  pdf.blank(6);

  pdf.title("Vendas — carro a carro");
  pdf.tableHeader(
    ["Data", "Veículo", "Placa", "Vendedor", "Venda", "Compra", "Desp.", "Com.", "Lucro", "Marg."],
    [18, 28, 16, 22, 18, 18, 16, 14, 18, 14],
  );
  const vendasMes = veiculos.filter(
    (v) => v.dataVenda?.startsWith(competencia) && isGestaoVeiculoVendido(v),
  );
  for (const v of vendasMes) {
    const comissao = v.despesas.filter((d) => d.categoria === "comissao").reduce((a, d) => a + Number(d.valor), 0);
    const despesas = v.despesas.reduce((a, d) => a + Number(d.valor), 0);
    pdf.tableRow(
      [
        v.dataVenda ?? "",
        `${v.marca} ${v.modelo}`.trim(),
        v.placa ?? "—",
        v.vendedor ?? "—",
        formatGestaoMoney(v.valorVenda),
        formatGestaoMoney(v.valorCompra),
        formatGestaoMoney(despesas),
        formatGestaoMoney(comissao),
        formatGestaoMoney(v.lucro.lucroLiquido),
        formatGestaoPct(v.lucro.margemPct),
      ],
      [18, 28, 16, 22, 18, 18, 16, 14, 18, 14],
    );
  }
  if (!vendasMes.length) pdf.line("Nenhuma venda no mês.");
  pdf.blank(6);

  pdf.title("Despesas dos carros (item a item)");
  pdf.tableHeader(["Data", "Veículo", "Categoria", "Descrição", "Valor", "Origem"], [18, 32, 24, 40, 22, 22]);
  for (const v of veiculos) {
    for (const d of v.despesas.filter((x) => x.data.startsWith(competencia))) {
      pdf.tableRow(
        [
          d.data,
          `${v.marca} ${v.modelo}`.slice(0, 20),
          d.categoria,
          (d.descricao ?? "").slice(0, 30),
          formatGestaoMoney(Number(d.valor)),
          origemDespesaLabel(d.origem_lancamento),
        ],
        [18, 32, 24, 40, 22, 22],
      );
    }
  }
  pdf.blank(6);

  pdf.title("Despesas operacionais (item a item)");
  pdf.tableHeader(["Venc.", "Categoria", "Descrição", "Valor", "Pago em"], [22, 36, 50, 24, 24]);
  const opsMes = contas.filter((c) => {
    if (c.tipo !== "pagar") return false;
    const ref = c.pago_em ?? c.vencimento;
    return ref.startsWith(competencia);
  });
  for (const c of opsMes) {
    pdf.tableRow(
      [
        c.vencimento,
        gestaoOperacionalCategoriaLabel(c.categoria_operacional),
        (c.observacao ?? "").slice(0, 40),
        formatGestaoMoney(Number(c.valor)),
        c.pago_em ?? "—",
      ],
      [22, 36, 50, 24, 24],
    );
  }
  pdf.blank(6);

  pdf.title("Contas recebidas / pagas no mês");
  pdf.tableHeader(["Tipo", "Categoria", "Valor", "Venc.", "Liquidado"], [22, 40, 28, 24, 24]);
  for (const c of contas) {
    const liq = c.tipo === "pagar" ? c.pago_em : c.recebido_em;
    if (!liq?.startsWith(competencia)) continue;
    pdf.tableRow(
      [
        c.tipo === "pagar" ? "Pagar" : "Receber",
        gestaoOperacionalCategoriaLabel(c.categoria_operacional),
        formatGestaoMoney(Number(c.valor)),
        c.vencimento,
        liq,
      ],
      [22, 40, 28, 24, 24],
    );
  }
  pdf.blank(6);

  pdf.title("Comissões por vendedor e bônus");
  const byVendedor = new Map<string, number>();
  for (const v of vendasMes) {
    const nome = v.vendedor ?? "Sem vendedor";
    const com = v.despesas.filter((d) => d.categoria === "comissao").reduce((a, d) => a + Number(d.valor), 0);
    byVendedor.set(nome, (byVendedor.get(nome) ?? 0) + com);
  }
  for (const [nome, val] of byVendedor) {
    pdf.line(`${nome}: ${formatGestaoMoney(val)}`);
  }
  for (const c of contas.filter((x) => x.origem === "bonus_g2" && x.vencimento.startsWith(competencia))) {
    pdf.line(`Bônus: ${c.observacao ?? "—"} — ${formatGestaoMoney(Number(c.valor))}`);
  }
  pdf.blank(6);

  pdf.title("Conciliação bancária e estoque");
  if (conciliacao) {
    pdf.line(`Transações conciliadas: ${conciliacao.conciliadas}`);
    pdf.line(`Transações pendentes / sem match: ${conciliacao.pendentes}`);
  } else {
    pdf.line("Resumo de conciliação não carregado nesta exportação.");
  }
  const estoque = veiculos.filter((v) => !isGestaoVeiculoVendido(v));
  const valorAnunciado = estoque.reduce((a, v) => a + (v.preco ?? 0), 0);
  const custoEstoque = estoque.reduce((a, v) => a + v.lucro.investido, 0);
  pdf.line(`Estoque atual: ${estoque.length} veículo(s)`);
  pdf.line(`Valor anunciado (soma): ${formatGestaoMoney(valorAnunciado)}`);
  pdf.line(`Custo / investido (soma): ${formatGestaoMoney(custoEstoque)}`);

  pdf.save(filename);
}
