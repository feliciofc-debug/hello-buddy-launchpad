import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import {
  compareDelta,
  competenciaLabelPt,
  competenciaShortLabelPt,
  shiftCompetencia,
  type GestaoResultadoMesMetrics,
} from "@/lib/gestao-resultado-mes.ts";

type Props = {
  competencia: string;
  onCompetenciaChange: (c: string) => void;
  metrics: GestaoResultadoMesMetrics;
  prevMetrics: GestaoResultadoMesMetrics;
  focusConnected: boolean | null;
  loading?: boolean;
  variant?: "page" | "dashboard";
  onNavigateVendidos?: () => void;
  onNavigateEstoque?: () => void;
  onNavigateResultado?: () => void;
  onEmitirNota?: () => void;
  onVerVendas?: () => void;
  onConectarNfe?: () => void;
};

function DeltaBadge({
  current,
  previous,
  invertTone,
}: {
  current: number;
  previous: number;
  invertTone?: boolean;
}) {
  const { diff, pct, improved } = compareDelta(current, previous);
  if (current === 0 && previous === 0) return null;
  const good = invertTone ? !improved : improved;
  const Icon = diff >= 0 ? "▲" : "▼";
  const tone = good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const pctTxt = pct != null ? ` ${Math.abs(pct).toFixed(0)}%` : "";
  return (
    <span className={`text-xs font-medium ${tone}`}>
      {Icon}{pctTxt} vs mês anterior
    </span>
  );
}

function BigMetric({
  label,
  value,
  sub,
  onClick,
  delta,
  invertDelta,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  onClick?: () => void;
  delta?: { current: number; previous: number };
  invertDelta?: boolean;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
      {delta && (
        <DeltaBadge current={delta.current} previous={delta.previous} invertTone={invertDelta} />
      )}
      {sub}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        {inner}
      </button>
    );
  }
  return <div className="rounded-xl border bg-card p-4">{inner}</div>;
}

export function GestaoResultadoMesStrip({
  competencia,
  onCompetenciaChange,
  metrics,
  prevMetrics,
  focusConnected,
  loading,
  variant = "page",
  onNavigateVendidos,
  onNavigateEstoque,
  onNavigateResultado,
  onEmitirNota,
  onVerVendas,
  onConectarNfe,
}: Props) {
  const { dre } = metrics;
  const prev = prevMetrics.dre;
  const empty = dre.qtdVendas === 0;

  const nfeLine = variant === "page" ? (
    <div className="mt-2 space-y-1">
      {focusConnected === false || focusConnected === null ? (
        <p className="text-[11px] text-muted-foreground">
          {onConectarNfe ? (
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={onConectarNfe}
            >
              Conecte a emissão de NF-e
            </button>
          ) : (
            <Link to="/configuracoes/integracoes?foco=nfe" className="underline hover:text-foreground">
              Conecte a emissão de NF-e
            </Link>
          )}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Notas fiscais emitidas: {metrics.nfesEmitidas} de {metrics.vendasComNfeAlvo} vendas
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onEmitirNota}>
          Emitir nota
        </button>
        <span className="text-muted-foreground">·</span>
        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onVerVendas ?? onNavigateVendidos}>
          Ver vendas
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {variant === "page" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mês anterior"
                onClick={() => onCompetenciaChange(shiftCompetencia(competencia, -1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="min-w-[10rem] text-center text-sm font-semibold capitalize md:text-base">
                Resultado — {competenciaLabelPt(competencia)}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Próximo mês"
                onClick={() => onCompetenciaChange(shiftCompetencia(competencia, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
          {variant === "dashboard" && (
            <h2 className="text-sm font-semibold capitalize">
              Resultado — {competenciaLabelPt(competencia)}
            </h2>
          )}
        </div>
        {variant === "dashboard" && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/gestao/lucro">Ver gestão</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <BigMetric
              label="Faturamento"
              value={formatGestaoMoney(dre.faturamento)}
              onClick={onNavigateVendidos}
              delta={{ current: dre.faturamento, previous: prev.faturamento }}
              sub={nfeLine}
            />
            <BigMetric
              label="Lucro líquido da loja"
              value={formatGestaoMoney(metrics.lucroExibido)}
              onClick={onNavigateResultado}
              delta={{
                current: metrics.lucroExibido,
                previous: prevMetrics.lucroExibido,
              }}
              sub={
                metrics.lucroLegenda ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">{metrics.lucroLegenda}</p>
                ) : undefined
              }
            />
            <BigMetric
              label="Carros vendidos"
              value={String(dre.qtdVendas)}
              onClick={onNavigateVendidos}
              delta={{ current: dre.qtdVendas, previous: prev.qtdVendas }}
            />
            <BigMetric
              label="Margem média"
              value={formatGestaoPct(metrics.margemMediaPct)}
              delta={{
                current: metrics.margemMediaPct ?? 0,
                previous: prevMetrics.margemMediaPct ?? 0,
              }}
            />
          </div>

          {empty && variant === "page" && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Nenhuma venda registrada em {competenciaShortLabelPt(competencia)} — registre na aba{" "}
              <button
                type="button"
                className="font-medium text-foreground underline"
                onClick={() => (onNavigateEstoque ?? onNavigateVendidos)?.()}
              >
                Estoque › Registrar venda
              </button>{" "}
              ou pelo WhatsApp: &quot;vendi o X6 por 520 mil&quot;.
            </p>
          )}
        </>
      )}
    </section>
  );
}
