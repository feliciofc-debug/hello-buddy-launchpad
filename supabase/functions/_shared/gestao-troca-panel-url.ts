import { resolveAppPublicBaseUrl } from "./vehicle-stock-vitrine-recado.ts";

/** Mesmo path que `src/App.tsx` → `<Route path="/gestao/trocas/:id" />` */
export const GESTAO_TROCA_FICHA_PATH_PREFIX = "/gestao/trocas";

export function buildGestaoTrocaFichaPanelUrl(
  trocaId: string,
  envUrl?: string | null,
): string {
  const id = String(trocaId || "").trim();
  const base = resolveAppPublicBaseUrl(envUrl);
  return `${base}${GESTAO_TROCA_FICHA_PATH_PREFIX}/${encodeURIComponent(id)}`;
}
