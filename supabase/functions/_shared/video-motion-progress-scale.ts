/** Escala monotônica global: preparando 0–10, renderizando 10–90, enviando 90–99, concluído 100. */

export function pctPreparando(fase: "inicio" | "fim"): number {
  return fase === "inicio" ? 3 : 10;
}

/** progress Remotion 0..1 → 10..90 */
export function pctRenderizando(progress0to1: number): number {
  const p = Math.min(1, Math.max(0, Number(progress0to1)));
  return Math.min(90, Math.max(10, Math.round(10 + p * 80)));
}

export function pctEnviando(fase: "inicio" | "meio" | "fim"): number {
  if (fase === "inicio") return 92;
  if (fase === "meio") return 96;
  return 99;
}

export function aceitaProgressoMonotonico(atual: number, novo: number): boolean {
  return clampPct(novo) >= clampPct(atual);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
