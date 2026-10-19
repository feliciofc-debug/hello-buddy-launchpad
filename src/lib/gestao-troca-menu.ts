import { shouldShowGestaoLucroMenu } from "./gestao-lucro-menu.ts";

export const GESTAO_TROCAS_ROUTE = "/gestao/trocas";

export function shouldShowGestaoTrocasMenu(
  clientType: string | null | undefined,
  segment: string | null | undefined,
  businessText: string | null | undefined,
  vitrineVeiculosDemo: boolean,
): boolean {
  return shouldShowGestaoLucroMenu(clientType, segment, businessText, vitrineVeiculosDemo);
}
