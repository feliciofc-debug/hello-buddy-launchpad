import { shouldShowFinanciamentosMenu } from "./client-menu-routes.ts";

export { shouldShowFinanciamentosMenu };

/** Badge do menu lateral: null = oculto; "9+" acima de 9. */
export function formatFinanciamentoPendingBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

export type FinanciamentoFichaStatus =
  | "pendente"
  | "em_analise"
  | "concluida"
  | "cancelada";

export const FINANCIAMENTO_FICHA_STATUS_OPTIONS: Array<{
  value: FinanciamentoFichaStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Todas" },
  { value: "pendente", label: "Novas" },
  { value: "em_analise", label: "Em análise" },
  { value: "concluida", label: "Concluídas" },
  { value: "cancelada", label: "Canceladas" },
];

export const FINANCIAMENTO_FICHA_CHANGED_EVENT = "financiamento-fichas-changed";

export function notifyFinanciamentoFichasChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FINANCIAMENTO_FICHA_CHANGED_EVENT));
  }
}
