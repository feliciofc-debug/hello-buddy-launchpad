import { shouldShowFinanciamentosMenu } from "./client-menu-routes.ts";

/** Mesma regra do menu Financiamentos (revenda ou vitrine_veiculos_demo). */
export function shouldShowGestaoLucroMenu(
  clientType: string | null | undefined,
  segment: string | null | undefined,
  businessText: string | null | undefined,
  vitrineVeiculosDemo: boolean,
): boolean {
  return shouldShowFinanciamentosMenu(
    clientType,
    segment,
    businessText,
    vitrineVeiculosDemo,
  );
}

export const GESTAO_LUCRO_ROUTE = "/gestao/lucro";
