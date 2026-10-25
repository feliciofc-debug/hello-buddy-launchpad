export const VEICULO_STATUS_ATIVOS_INTERNOS = [
  "disponivel",
  "reservado",
  "em_preparacao",
] as const;

export type VeiculoStatusAtivoInterno =
  typeof VEICULO_STATUS_ATIVOS_INTERNOS[number];

export function isVeiculoEstoqueAtivoInterno(status: string): boolean {
  return (VEICULO_STATUS_ATIVOS_INTERNOS as readonly string[]).includes(status);
}

export function statusInicialEntradaVeiculo(input: {
  fotos: string[];
  preco: number | null;
}): "disponivel" | "em_preparacao" {
  return input.fotos.length > 0 && input.preco != null && input.preco > 0
    ? "disponivel"
    : "em_preparacao";
}

export function validarLiberacaoVitrine(input: {
  fotos: string[];
  preco: number | null;
}): { ok: true } | { ok: false; faltantes: Array<"foto" | "preco"> } {
  const faltantes: Array<"foto" | "preco"> = [];
  if (!input.fotos.length) faltantes.push("foto");
  if (input.preco == null || input.preco <= 0) faltantes.push("preco");
  return faltantes.length ? { ok: false, faltantes } : { ok: true };
}
