import { Link, useLocation } from "react-router-dom";
import { GESTAO_GROUP_ICON, GESTAO_SIDEBAR_ITEMS, gestaoSidebarActive } from "@/lib/gestao-nav.ts";

type Props = {
  onNavigate?: () => void;
};

export function GestaoSidebarNav({ onNavigate }: Props) {
  const location = useLocation();
  const GroupIcon = GESTAO_GROUP_ICON;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground">
        <GroupIcon className="h-5 w-5 shrink-0 text-primary" />
        Gestão
      </div>
      <div className="ml-2 space-y-0.5 border-l border-border pl-2">
        {GESTAO_SIDEBAR_ITEMS.map((item) => {
          const active = gestaoSidebarActive(location.pathname, location.search, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.path}
              state={{ from: `${location.pathname}${location.search}` }}
              onClick={onNavigate}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
