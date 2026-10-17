import { formatGestaoMoney } from "./gestao-format.ts";

export function buildConciliacaoPendenteReply(qtd: number, valor: number): string {
  if (qtd <= 0) return "Tudo conciliado — nenhuma transação pendente no extrato.";
  return `Falta conciliar: ${qtd} transação(ões), total ${formatGestaoMoney(valor)}. Veja Financeiro → Conciliação.`;
}
