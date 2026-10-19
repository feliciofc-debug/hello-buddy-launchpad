export function assertGestaoTrocaLaudoNaoFinalizado(
  troca: { laudo_status?: string | null },
): void {
  if (String(troca.laudo_status ?? "rascunho") === "finalizado") {
    throw new Error("Laudo finalizado — reabra o laudo para editar.");
  }
}
