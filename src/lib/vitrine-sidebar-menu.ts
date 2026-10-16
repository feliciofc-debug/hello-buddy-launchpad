import {
  shouldShowFinanciamentosMenu,
  usesVehicleInventoryMenu,
} from "./client-menu-routes.ts";

export type VitrineSidebarTenantContext = {
  clientType: string | null | undefined;
  segment: string | null | undefined;
  businessText: string | null | undefined;
  vitrineVeiculosDemo: boolean;
};

export function resolveVitrineSidebarFlags(ctx: VitrineSidebarTenantContext) {
  const usesVehicleInventory = usesVehicleInventoryMenu(
    ctx.clientType,
    ctx.segment,
    ctx.businessText,
  );
  const showFinanciamentosMenu = shouldShowFinanciamentosMenu(
    ctx.clientType,
    ctx.segment,
    ctx.businessText,
    ctx.vitrineVeiculosDemo,
  );
  const showDemoVehicleStockAfterProdutos = showFinanciamentosMenu &&
    ctx.vitrineVeiculosDemo &&
    !usesVehicleInventory;

  return {
    usesVehicleInventory,
    showFinanciamentosMenu,
    showDemoVehicleStockAfterProdutos,
  };
}

/** Insere Estoque + Financiamentos (demo produtos) ou só Financiamentos (revenda). */
export function injectVitrineSidebarMenuItems<T extends { id: string }>(
  items: readonly T[],
  ctx: VitrineSidebarTenantContext & {
    vehicleStockItem: T;
    financingItem: T;
  },
): T[] {
  const { usesVehicleInventory, showFinanciamentosMenu } = resolveVitrineSidebarFlags(ctx);
  if (!showFinanciamentosMenu) {
    return [...items];
  }

  const hasId = (id: string) => items.some((item) => item.id === id);
  const out: T[] = [];

  for (const item of items) {
    out.push(item);

    if (usesVehicleInventory && item.id === "veiculos") {
      if (!hasId("financiamentos")) {
        out.push(ctx.financingItem);
      }
      continue;
    }

    if (
      !usesVehicleInventory &&
      ctx.vitrineVeiculosDemo &&
      item.id === "produtos"
    ) {
      if (!hasId("veiculos")) {
        out.push(ctx.vehicleStockItem);
      }
      if (!hasId("financiamentos")) {
        out.push(ctx.financingItem);
      }
    }
  }

  return out;
}
