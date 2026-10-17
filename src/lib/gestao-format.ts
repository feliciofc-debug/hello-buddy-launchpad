export function formatGestaoMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatGestaoPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function gestaoLucroTone(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "text-amber-600 dark:text-amber-400";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function gestaoMargemPct(
  lucro: number | null,
  base: number | null,
): number | null {
  if (lucro == null || base == null || base <= 0) return null;
  return (lucro / base) * 100;
}
