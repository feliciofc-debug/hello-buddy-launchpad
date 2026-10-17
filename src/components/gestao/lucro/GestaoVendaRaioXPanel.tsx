import {
  calcVendaRaioX,
  type GestaoDespesaRaioX,
} from "../../../../supabase/functions/_shared/gestao-venda-raio-x.ts";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import { AlertTriangle } from "lucide-react";

type Props = {
  valorVenda: number | null;
  valorCompra: number | null;
  despesas: GestaoDespesaRaioX[];
  compact?: boolean;
};

function line(label: string, value: string, extra?: string) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">
        {value}
        {extra ? <span className="ml-1 text-xs font-normal text-muted-foreground">{extra}</span> : null}
      </span>
    </div>
  );
}

export function GestaoVendaRaioXPanel({ valorVenda, valorCompra, despesas, compact }: Props) {
  const raio = calcVendaRaioX({ valorVenda, valorCompra, despesas });
  if (!raio || valorCompra == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Raio-X disponível após informar compra e venda.
      </p>
    );
  }

  const alertCls = raio.alertLevel === "red"
    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    : raio.alertLevel === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    : "";

  return (
    <div className={`space-y-2 rounded-lg border p-3 ${compact ? "text-xs" : ""}`}>
      {!compact && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raio-X da venda</p>}
      {line("Venda", formatGestaoMoney(raio.valorVenda))}
      {line("− Compra", formatGestaoMoney(raio.valorCompra))}
      {line("− Despesas", formatGestaoMoney(raio.despesasSemComissao))}
      {line(
        "= Lucro bruto",
        formatGestaoMoney(raio.lucroBruto),
        raio.margemBrutaPct != null ? `(${formatGestaoPct(raio.margemBrutaPct)})` : undefined,
      )}
      {line(
        "− Comissão",
        formatGestaoMoney(raio.comissao),
        raio.comissaoPctDoLucro != null
          ? `→ ${raio.comissaoPctDoLucro.toFixed(1)}% do lucro`
          : undefined,
      )}
      {line(
        "= Lucro final",
        formatGestaoMoney(raio.lucroFinal),
        raio.margemFinalPct != null ? `(${formatGestaoPct(raio.margemFinalPct)})` : undefined,
      )}
      {raio.motivoProvavel && raio.alertLevel === "none" && (
        <p className="text-xs text-muted-foreground">{raio.motivoProvavel}</p>
      )}
      {raio.alertMessage && (
        <div className={`flex gap-2 rounded-md border p-2 text-xs ${alertCls}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{raio.alertMessage}</span>
        </div>
      )}
    </div>
  );
}

export function raioXFromVeiculo(v: {
  valorVenda: number | null;
  valorCompra: number | null;
  despesas: { valor: number; categoria: string }[];
}) {
  return calcVendaRaioX({
    valorVenda: v.valorVenda,
    valorCompra: v.valorCompra,
    despesas: v.despesas.map((d) => ({ valor: Number(d.valor), categoria: d.categoria })),
  });
}
