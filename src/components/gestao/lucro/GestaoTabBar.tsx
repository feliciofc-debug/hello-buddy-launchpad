import {
  BarChart3,
  FileSignature,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { GestaoLucroAba } from "@/lib/gestao-nav.ts";
import { cn } from "@/lib/utils";

export type GestaoTabDef = {
  id: GestaoLucroAba;
  label: string;
  icon: typeof Package;
  badge?: string | number | null;
};

type Props = {
  value: GestaoLucroAba;
  onChange: (aba: GestaoLucroAba) => void;
  vendidosCount?: number;
  notasPendentes?: number;
};

export function buildGestaoTabs(vendidosCount?: number, notasPendentes?: number): GestaoTabDef[] {
  const vendidosLabel = vendidosCount != null && vendidosCount > 0
    ? `Vendidos ${vendidosCount}`
    : "Vendidos";
  const notasLabel = notasPendentes != null && notasPendentes > 0
    ? `Notas ${notasPendentes} pend.`
    : "Notas fiscais";

  return [
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "vendidos", label: vendidosLabel, icon: ShoppingCart },
    { id: "notas", label: notasLabel, icon: Receipt, badge: notasPendentes || null },
    { id: "contratos", label: "Contratos", icon: FileSignature },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "equipe", label: "Equipe", icon: Users },
    { id: "despesas", label: "Despesas", icon: Wrench },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  ];
}

export function GestaoTabBar({ value, onChange, vendidosCount, notasPendentes }: Props) {
  const tabs = buildGestaoTabs(vendidosCount, notasPendentes);

  return (
    <div className="relative -mx-1">
      <div
        className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scroll-smooth px-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)] md:[mask-image:none]"
        role="tablist"
        aria-label="Seções da gestão"
      >
        {tabs.map((tab) => {
          const active = value === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                "hover:border-primary/40 hover:bg-muted/60",
                active
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20 underline-offset-4"
                  : "border-border bg-card text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
