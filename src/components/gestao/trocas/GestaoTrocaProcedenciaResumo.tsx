import type { GestaoTrocaProcedenciaLaudo } from "@/lib/gestao-troca-procedencia-display.ts";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function Icon({ kind }: { kind: "ok" | "warn" }) {
  return <span aria-hidden>{kind === "warn" ? "⚠️" : "✅"}</span>;
}

type Props = {
  procedencia: GestaoTrocaProcedenciaLaudo | null;
  /** Quando false e null consultaId → "Procedência não consultada" (laudo). */
  laudoMode?: boolean;
  processando?: boolean;
};

export function GestaoTrocaProcedenciaResumo({
  procedencia,
  laudoMode,
  processando,
}: Props) {
  if (!procedencia) {
    return (
      <p className="text-sm text-muted-foreground">
        {laudoMode ? "Procedência não consultada." : "Nenhuma consulta de procedência."}
      </p>
    );
  }

  if (processando || procedencia.emProcessamento) {
    return <p className="text-sm text-muted-foreground">Consulta em processamento…</p>;
  }

  if (procedencia.indisponivel) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Serviço indisponível no momento da consulta.</p>
        {procedencia.consultadoEm && <p>Consulta: {formatDt(procedencia.consultadoEm)}</p>}
        {procedencia.placaTeste && <p className="text-xs">(placa de teste)</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        {procedencia.linhas.map((l) => (
          <li key={l.label} className="flex flex-wrap gap-1">
            <Icon kind={l.icon} />
            <span className="font-medium">{l.label}</span>
            <span className="text-muted-foreground">· {l.detail}</span>
          </li>
        ))}
      </ul>
      {procedencia.veiculoResumo && (
        <p>
          <span className="font-medium">Veículo (base nacional):</span>{" "}
          {procedencia.veiculoResumo}
        </p>
      )}
      {procedencia.consultadoEm && (
        <p className="text-xs text-muted-foreground">
          Consulta em {formatDt(procedencia.consultadoEm)}
          {procedencia.placaTeste ? " · (placa de teste)" : ""}
        </p>
      )}
      {procedencia.divergenciaFicha && !laudoMode && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Divergência ficha × procedência: {procedencia.divergenciaFicha}
        </p>
      )}
    </div>
  );
}
