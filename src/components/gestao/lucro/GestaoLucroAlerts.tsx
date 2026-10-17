import { AlertTriangle } from "lucide-react";
import type { GestaoLucroAlert, GestaoLucroAlertKind } from "@/lib/gestao-lucro-alerts.ts";
import { alertLabel } from "@/lib/gestao-lucro-alerts.ts";

type Props = {
  alerts: GestaoLucroAlert[];
  activeKind: GestaoLucroAlertKind | null;
  onSelect: (kind: GestaoLucroAlertKind | null) => void;
};

export function GestaoLucroAlerts({ alerts, activeKind, onSelect }: Props) {
  if (!alerts.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a) => {
        const active = activeKind === a.kind;
        return (
          <button
            key={a.kind}
            type="button"
            onClick={() => onSelect(active ? null : a.kind)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-amber-600 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {alertLabel(a.kind)} ({a.count})
          </button>
        );
      })}
    </div>
  );
}
