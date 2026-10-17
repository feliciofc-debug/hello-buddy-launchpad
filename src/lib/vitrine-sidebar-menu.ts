import {
  shouldShowFinanciamentosMenu,
  usesVehicleInventoryMenu,
} from "./client-menu-routes.ts";
import { shouldShowGestaoLucroMenu } from "./gestao-lucro-menu.ts";

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
  const showGestaoLucroMenu = shouldShowGestaoLucroMenu(
    ctx.clientType,
    ctx.segment,
    ctx.businessText,
    ctx.vitrineVeiculosDemo,
  );

  return {
    usesVehicleInventory,
    showFinanciamentosMenu,
    showDemoVehicleStockAfterProdutos,
    showGestaoLucroMenu,
  };
}

/** Insere Estoque + Financiamentos (demo produtos) ou só Financiamentos (revenda). */
export function injectVitrineSidebarMenuItems<T extends { id: string }>(
  items: readonly T[],
  ctx: VitrineSidebarTenantContext & {
    vehicleStockItem: T;
    financingItem: T;
    gestaoLucroItem?: T;
  },
): T[] {
  const flags = resolveVitrineSidebarFlags(ctx);
  const { usesVehicleInventory, showFinanciamentosMenu, showGestaoLucroMenu } =
    flags;
  if (!showFinanciamentosMenu && !showGestaoLucroMenu) {
    return [...items];
  }

  const hasId = (id: string) => items.some((item) => item.id === id);
  const out: T[] = [];

  const pushGestaoAfterStock = () => {
    if (showGestaoLucroMenu && ctx.gestaoLucroItem && !hasId("gestao-lucro")) {
      out.push(ctx.gestaoLucroItem);
    }
  };

  for (const item of items) {
    out.push(item);

    if (usesVehicleInventory && item.id === "veiculos") {
      if (showFinanciamentosMenu && !hasId("financiamentos")) {
        out.push(ctx.financingItem);
      }
      pushGestaoAfterStock();
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
      if (showFinanciamentosMenu && !hasId("financiamentos")) {
        out.push(ctx.financingItem);
      }
      pushGestaoAfterStock();
    }
  }

  return out;
}
