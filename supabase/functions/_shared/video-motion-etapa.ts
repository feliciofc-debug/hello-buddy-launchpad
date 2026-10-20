export const ETAPAS_MOTION = [
  "na_fila",
  "preparando",
  "renderizando",
  "enviando",
  "concluido",
  "erro",
] as const;

export type EtapaMotion = (typeof ETAPAS_MOTION)[number];

export function normalizarEtapaMotion(raw: unknown): EtapaMotion | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return (ETAPAS_MOTION as readonly string[]).includes(v) ? (v as EtapaMotion) : null;
}

export function clampProgressoPct(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
