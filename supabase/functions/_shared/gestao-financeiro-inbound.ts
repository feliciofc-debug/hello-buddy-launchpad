import { addDiasYmd } from "./gestao-date-br.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import { calcDreMes, type GestaoOperacionalDreLine, type GestaoVendaDreLine } from "./gestao-dre-calc.ts";
import type { GestaoContaFluxo } from "./gestao-fluxo-calc.ts";
import { gestaoOperacionalCategoriaLabel } from "./gestao-operacional-categorias.ts";

export type GestaoContaInbound = GestaoContaFluxo & {
  categoria: string;
  observacao: string | null;
};

function addDaysIso(iso: string, days: number): string {
  return addDiasYmd(iso, days);
}

function weekEnd(from: string): string {
  return addDaysIso(from, 6);
}

export function buildContasVencemAmanhaReply(
  contas: GestaoContaInbound[],
  today: string,
): string {
  const amanha = addDaysIso(today, 1);
  const list = contas.filter((c) => c.vencimento === amanha && !(c.tipo === "pagar" ? c.pago_em : c.recebido_em));
  if (!list.length) return "Nada vence amanhã.";
  const lines = list.map((c) =>
    `${c.tipo === "pagar" ? "Pagar" : "Receber"} ${formatGestaoMoney(c.valor)} — ${
      gestaoOperacionalCategoriaLabel(c.categoria)
    }`
  );
  return `Vence amanhã (${amanha}):\n${lines.join("\n")}`;
}

export function buildContasSemanaReply(contas: GestaoContaInbound[], today: string): string {
  const end = weekEnd(today);
  const list = contas.filter((c) =>
    c.vencimento >= today && c.vencimento <= end &&
    !(c.tipo === "pagar" ? c.pago_em : c.recebido_em)
  );
  if (!list.length) return "Nada pendente nesta semana.";
  const lines = list.slice(0, 12).map((c) =>
    `${c.vencimento}: ${c.tipo === "pagar" ? "Pagar" : "Receber"} ${formatGestaoMoney(c.valor)}`
  );
  return `Esta semana (${today} a ${end}):\n${lines.join("\n")}`;
}

export function buildAReceberReply(contas: GestaoContaInbound[]): string {
  const open = contas.filter((c) => c.tipo === "receber" && !c.recebido_em);
  const total = open.reduce((a, c) => a + c.valor, 0);
  if (!open.length) return "Nada a receber em aberto.";
  return `A receber: ${formatGestaoMoney(total)} em ${open.length} lançamento(s).`;
}

export function buildLucroLojaMesReply(
  competencia: string,
  vendas: GestaoVendaDreLine[],
  operacionais: GestaoOperacionalDreLine[],
): string {
  const dre = calcDreMes(competencia, vendas, operacionais);
  return `Resultado ${competencia}: lucro líquido da loja ${formatGestaoMoney(dre.lucroLiquidoLoja)} ` +
    `(carros ${formatGestaoMoney(dre.lucroCarros)}, operacional ${formatGestaoMoney(dre.despesasOperacionais)}).`;
}

export function buildContadorLinkReply(linkUrl: string, competencia: string): string {
  return `Pacote ${competencia} pronto (leitura só do mês). Encaminhe ao contador:\n${linkUrl}\n` +
    "Documento gerencial — validação fiscal com o contador.";
}

export function buildRevogarContadorLinkReply(revogados: number): string {
  if (revogados <= 0) return "Nenhum link ativo do contador para cancelar.";
  return `Pronto: ${revogados} link(s) do contador cancelado(s). Quem tinha o link não consegue mais abrir.`;
}
