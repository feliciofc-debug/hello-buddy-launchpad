export type TrocaVendaComposicaoInput = {
  precoVenda: number;
  entrada: number;
  financiamentoValor: number;
  trocaValor: number;
};

export type TrocaVendaComposicao = {
  saldo: number;
  tipoFinanceiro: "receber" | "pagar" | "quitado";
  valorFinanceiro: number;
  efeitoCaixaHoje: number;
};

const money = (value: number) => Math.round(value * 100) / 100;
const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function calcularComposicaoTrocaVenda(
  input: TrocaVendaComposicaoInput,
): TrocaVendaComposicao {
  const preco = safe(input.precoVenda);
  const entrada = safe(input.entrada);
  const financiamento = safe(input.financiamentoValor);
  const troca = safe(input.trocaValor);
  const saldo = money(preco - entrada - financiamento - troca);
  const tipoFinanceiro = saldo > 0 ? "receber" : saldo < 0 ? "pagar" : "quitado";
  const troco = saldo < 0 ? Math.abs(saldo) : 0;
  return {
    saldo,
    tipoFinanceiro,
    valorFinanceiro: money(Math.abs(saldo)),
    efeitoCaixaHoje: money(entrada - troco),
  };
}

export function calcularSobreAvaliacaoTroca(input: {
  valorTroca: number;
  teto: number | null;
  lucroContabil: number | null;
}): {
  excesso: number;
  lucroReal: number | null;
  aviso: string | null;
} {
  const excesso = input.teto == null
    ? 0
    : money(Math.max(0, safe(input.valorTroca) - safe(input.teto)));
  const lucroReal = input.lucroContabil == null
    ? null
    : money(input.lucroContabil - excesso);
  return {
    excesso,
    lucroReal,
    aviso: excesso > 0
      ? `Troca fechada R$ ${excesso.toLocaleString("pt-BR")} acima do teto — lucro real desta operação: R$ ${(lucroReal ?? 0).toLocaleString("pt-BR")}`
      : null,
  };
}

export function assertTrocaDisponivel(input: {
  trocaId: string;
  vendaExistenteId: string | null;
  vendaAtualId: string | null;
}) {
  if (
    input.vendaExistenteId &&
    input.vendaExistenteId !== input.vendaAtualId
  ) {
    throw new Error("Esta troca já foi usada em outra venda.");
  }
}

/** Simulador puro da atomicidade do RPC usado pelos testes de regressão. */
export function simularTransacaoTrocaVenda(
  etapas: Array<() => unknown>,
): unknown[] {
  const staged: unknown[] = [];
  try {
    for (const etapa of etapas) staged.push(etapa());
    return staged;
  } catch (error) {
    staged.length = 0;
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      staged,
    });
  }
}
