import { Database, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GestaoMolicarSnapshot } from "@/lib/gestao-troca-types.ts";

type Props = {
  snapshot: GestaoMolicarSnapshot | null;
  loading?: boolean;
  consulting?: boolean;
  error?: string | null;
  title?: string;
  disabled?: boolean;
  onUpdate?: () => void;
};

const money = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (value: string | null) => {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : value;
};

export function MolicarPriceCard({
  snapshot,
  loading = false,
  consulting = false,
  error,
  title = "Preços Molicar",
  disabled = false,
  onUpdate,
}: Props) {
  const prices = snapshot
    ? [
      ["Referência", snapshot.referencia],
      ["B2C", snapshot.b2c],
      ["B2B", snapshot.b2b],
      ["C2C", snapshot.c2c],
      ["C2B", snapshot.c2b],
      ["Novo", snapshot.novo],
    ] as const
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            {title}
          </CardTitle>
          {onUpdate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || consulting || loading}
              onClick={onUpdate}
            >
              {consulting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-2 h-4 w-4" />}
              {snapshot ? "Atualizar" : "Consultar pela placa"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !snapshot
          ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando referência…
            </p>
          )
          : snapshot
          ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {prices.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold">{money(value)}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-1 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-3">
                <p>Data da referência: {date(snapshot.dataReferencia)}</p>
                <p>Atualização: {date(snapshot.atualizadoEm ?? snapshot.consultadoEm)}</p>
                <p>Fonte: {snapshot.proveniencia}</p>
              </div>
              {snapshot.procedencia
                ? snapshot.alertasProcedencia.length > 0
                  ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">Alertas de procedência</p>
                      <p>{snapshot.alertasProcedencia.join(" · ")}</p>
                    </div>
                  )
                  : (
                    <p className="text-sm text-emerald-700">
                      Procedência consultada: nenhum alerta retornado.
                    </p>
                  )
                : (
                  <p className="text-sm text-muted-foreground">
                    Procedência: serviço não contratado.
                  </p>
                )}
            </>
          )
          : (
            <p className="text-sm text-muted-foreground">
              Consulte uma placa para ver referência, B2C, B2B, C2C, C2B e preço de novo.
            </p>
          )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
