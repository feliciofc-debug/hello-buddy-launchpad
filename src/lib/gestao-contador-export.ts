import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import {
  buildGestaoContadorPacote,
  type GestaoContadorPacote,
} from "../../supabase/functions/_shared/gestao-contador-pacote-build.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import {
  contasToDreOperacional,
  type GestaoContaLancamento,
  veiculosToDreVendas,
} from "./gestao-financeiro-load.ts";
import type { GestaoVeiculoEnriched } from "./gestao-lucro-types.ts";

export function buildContadorPacoteFromApp(
  competencia: string,
  nomeEmpresa: string,
  veiculos: GestaoVeiculoEnriched[],
  contas: GestaoContaLancamento[],
): GestaoContadorPacote {
  return buildGestaoContadorPacote({
    competencia,
    nomeEmpresa,
    vendas: veiculosToDreVendas(veiculos),
    operacionais: contasToDreOperacional(contas),
    contas: contas
      .filter((c) => c.vencimento.startsWith(competencia))
      .map((c) => ({
        tipo: c.tipo,
        categoria: c.categoria_operacional,
        categoriaLabel: c.categoria_operacional,
        valor: Number(c.valor),
        vencimento: c.vencimento,
        liquidadoEm: c.tipo === "pagar" ? c.pago_em : c.recebido_em,
        observacao: c.observacao,
      })),
    comissoesBonus: contas
      .filter((c) => c.origem === "bonus_g2" && c.vencimento.startsWith(competencia))
      .map((c) => ({ descricao: c.observacao ?? "Bônus", valor: Number(c.valor) })),
  });
}

export function downloadContadorXlsx(pacote: GestaoContadorPacote, filename: string) {
  const wb = XLSX.utils.book_new();
  const dre = pacote.dre;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Resultado", pacote.competencia],
    ["Faturamento", dre.faturamento],
    ["Custo carros vendidos", dre.custoCarros],
    ["Despesas carros", dre.despesasCarros],
    ["Lucro dos carros", dre.lucroCarros],
    ["Despesas operacionais", dre.despesasOperacionais],
    ["Lucro líquido da loja", dre.lucroLiquidoLoja],
    ["", pacote.aviso],
  ]), "Resultado");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    pacote.vendas.map((v) => ({
      data: v.dataVenda,
      veiculo: v.veiculoId,
      venda: v.valorVenda,
      despesas: v.despesas.reduce((a, d) => a + d.valor, 0),
    })),
  ), "Vendas");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    pacote.vendas.map((v) => ({
      veiculo: v.veiculoId,
      data_venda: v.dataVenda,
      valor_compra: v.valorCompra,
    })),
  ), "Compras");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    pacote.vendas.flatMap((v) =>
      v.despesas.map((d) => ({
        veiculo: v.veiculoId,
        categoria: d.categoria,
        valor: d.valor,
      })),
    ),
  ), "Despesas carros");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pacote.operacionais), "Despesas operacionais");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pacote.contas), "Contas");

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pacote.comissoesBonus), "Comissões e bônus");

  XLSX.writeFile(wb, filename);
}

export function downloadContadorPdf(pacote: GestaoContadorPacote, filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(pacote.nomeEmpresa || "Gestão", 14, 18);
  doc.setFontSize(11);
  doc.text(`Pacote contador — ${pacote.competencia}`, 14, 26);
  doc.setFontSize(10);
  let y = 36;
  for (const line of [
    `Faturamento: ${formatGestaoMoney(pacote.dre.faturamento)}`,
    `Lucro dos carros: ${formatGestaoMoney(pacote.dre.lucroCarros)}`,
    `Despesas operacionais: ${formatGestaoMoney(pacote.dre.despesasOperacionais)}`,
    `Lucro líquido da loja: ${formatGestaoMoney(pacote.dre.lucroLiquidoLoja)}`,
  ]) {
    doc.text(line, 14, y);
    y += 6;
  }
  y += 4;
  doc.setFontSize(8);
  doc.text(pacote.aviso, 14, y, { maxWidth: 180 });
  doc.save(filename);
}
