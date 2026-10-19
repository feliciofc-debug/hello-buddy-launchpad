export type GestaoTrocaStatus =
  | "em_avaliacao"
  | "aguardando_aprovacao"
  | "aprovada"
  | "fechada"
  | "recusada_cliente"
  | "perdida"
  | "cancelada";

export type GestaoTrocaAcao =
  | "solicitar_aprovacao"
  | "aprovar"
  | "recusar_aprovacao"
  | "fechar"
  | "cliente_recusou"
  | "perdida"
  | "cancelar";

const TRANSITIONS: Record<GestaoTrocaAcao, { from: GestaoTrocaStatus[]; to: GestaoTrocaStatus }> = {
  solicitar_aprovacao: { from: ["em_avaliacao"], to: "aguardando_aprovacao" },
  aprovar: { from: ["aguardando_aprovacao"], to: "aprovada" },
  recusar_aprovacao: { from: ["aguardando_aprovacao"], to: "em_avaliacao" },
  fechar: { from: ["aprovada"], to: "fechada" },
  cliente_recusou: {
    from: ["em_avaliacao", "aguardando_aprovacao", "aprovada"],
    to: "recusada_cliente",
  },
  perdida: {
    from: ["em_avaliacao", "aguardando_aprovacao", "aprovada"],
    to: "perdida",
  },
  cancelar: {
    from: ["em_avaliacao", "aguardando_aprovacao", "aprovada"],
    to: "cancelada",
  },
};

export function assertGestaoTrocaTransicao(
  statusAtual: GestaoTrocaStatus,
  acao: GestaoTrocaAcao,
): GestaoTrocaStatus {
  const rule = TRANSITIONS[acao];
  if (!rule) throw new Error("Ação inválida.");
  if (!rule.from.includes(statusAtual)) {
    throw new Error(`Não é possível ${acao} com status ${statusAtual}.`);
  }
  return rule.to;
}
