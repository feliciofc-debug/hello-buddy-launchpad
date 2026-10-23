import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GestaoLucroAlert, GestaoLucroAlertKind } from "@/lib/gestao-lucro-alerts.ts";
import { alertLabel } from "@/lib/gestao-lucro-alerts.ts";

type Props = {
  alerts: GestaoLucroAlert[];
  activeKind: GestaoLucroAlertKind | null;
  onSelect: (kind: GestaoLucroAlertKind | null) => void;
  onCorrigirComissao?: (veiculoId: string) => void;
};

export function GestaoLucroAlerts({ alerts, activeKind, onSelect, onCorrigirComissao }: Props) {
  const comissaoAlert = alerts.find((a) => a.kind === "lucro_negativo_comissao");
  const chipAlerts = alerts.filter((a) => a.kind !== "lucro_negativo_comissao");

  if (!alerts.length) return null;

  return (
    <div className="space-y-3">
      {comissaoAlert && comissaoAlert.count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">
            {comissaoAlert.count === 1
              ? "Lucro negativo neste carro — a comissão pode estar errada."
              : `${comissaoAlert.count} carros com lucro negativo — confira a comissão.`}
          </p>
          {onCorrigirComissao && comissaoAlert.veiculoIds[0] && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onCorrigirComissao(comissaoAlert.veiculoIds[0])}
            >
              Corrigir comissão
            </Button>
          )}
        </div>
      )}
      {chipAlerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chipAlerts.map((a) => {
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
      )}
    </div>
  );
}
