import type { LucideIcon } from "lucide-react";
import { injectVitrineSidebarMenuItems } from "@/lib/vitrine-sidebar-menu";
import type { VitrineSidebarTenantContext } from "@/lib/vitrine-sidebar-menu";

export type AppSidebarItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  highlight?: boolean;
};

const AMZ_AUTO_ALLOWED_IDS = new Set([
  "veiculos",
  "financiamentos",
  "gestao-lucro",
  "whatsapp",
  "leads",
  "midias",
  "integracoes-portais",
]);

export function buildAmzAutoSidebarItems(
  ctx: VitrineSidebarTenantContext & {
    t: (key: string, fallback?: string) => string;
    vehicleStockItem: AppSidebarItem;
    financingItem: AppSidebarItem;
    gestaoLucroItem?: AppSidebarItem;
    whatsappItem: AppSidebarItem;
    leadsItem: AppSidebarItem;
    vitrineItem: AppSidebarItem;
    integracoesItem: AppSidebarItem;
    showFinanciamentosMenu: boolean;
    showGestaoLucroMenu: boolean;
  },
): AppSidebarItem[] {
  const seed: AppSidebarItem[] = [
    ctx.vehicleStockItem,
    ctx.whatsappItem,
    ctx.leadsItem,
    ctx.vitrineItem,
    ctx.integracoesItem,
  ];

  const withVitrine = injectVitrineSidebarMenuItems(seed, {
    clientType: ctx.clientType,
    segment: ctx.segment,
    businessText: ctx.businessText,
    vitrineVeiculosDemo: ctx.vitrineVeiculosDemo,
    vehicleStockItem: ctx.vehicleStockItem,
    financingItem: ctx.financingItem,
    gestaoLucroItem: ctx.showGestaoLucroMenu ? ctx.gestaoLucroItem : undefined,
  });

  return withVitrine.filter((item) => AMZ_AUTO_ALLOWED_IDS.has(item.id));
}
