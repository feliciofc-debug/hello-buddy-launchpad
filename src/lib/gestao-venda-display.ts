/** Data YYYY-MM-DD → DD/MM/YYYY para exibição ao lojista. */
export function formatGestaoDataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function isGestaoVeiculoVendido(v: { status: string }): boolean {
  return v.status === "vendido";
}
