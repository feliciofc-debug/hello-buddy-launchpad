import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { EtapaMotionJob } from "@/hooks/useVeiculoVideoJobPoll";

export type VehicleMotionJobSnapshot = {
  id: string;
  status: string;
  titulo: string | null;
  erro_mensagem: string | null;
  etapa?: EtapaMotionJob | null;
  progresso_pct?: number;
  posicao_fila?: number | null;
  elapsed_sec?: number;
  eta_sec?: number | null;
  stale?: boolean;
};

const ETAPA_LABEL: Record<string, string> = {
  na_fila: "Na fila",
  preparando: "Preparando fotos",
  renderizando: "Renderizando",
  enviando: "Enviando vídeo",
  concluido: "Pronto",
  erro: "Erro",
};

const STATUS_LABEL: Record<string, { label: string; variant?: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Na fila", variant: "secondary" },
  processando: { label: "Em produção", variant: "default" },
  falha: { label: "Erro", variant: "destructive" },
  falha_definitiva: { label: "Erro", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

function formatDuracao(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m} min ${s.toString().padStart(2, "0")}s`;
}

export function VehicleVideoJobProgressCard(props: {
  job: VehicleMotionJobSnapshot | null;
  onRetry?: (jobId: string) => void;
  retrying?: boolean;
}) {
  const { job, onRetry, retrying } = props;
  if (!job) return null;

  const active = job.status === "pendente" || job.status === "processando";
  const failed = job.status === "falha" || job.status === "falha_definitiva";
  if (!active && !failed && !job.stale) return null;

  const etapaKey = job.etapa || (job.status === "pendente" ? "na_fila" : "renderizando");
  const etapaTexto = ETAPA_LABEL[etapaKey] ?? etapaKey;
  const meta = STATUS_LABEL[job.status] ?? { label: job.status, variant: "secondary" as const };
  const pct = job.stale ? job.progresso_pct ?? 0 : Math.max(job.progresso_pct ?? 0, job.status === "pendente" ? 0 : 5);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          🎬 Vídeo em produção — leva ~3 a 5 min
          {active && !job.stale && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <Badge variant={job.stale ? "destructive" : meta.variant}>{job.stale ? "Travado" : meta.label}</Badge>
          <Badge variant="outline">{etapaTexto}</Badge>
        </CardTitle>
        {job.titulo && (
          <p className="text-sm text-muted-foreground truncate">{job.titulo}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {active && !job.stale && (
          <>
            <Progress value={pct} className="h-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>{pct}%</span>
              {job.elapsed_sec != null && (
                <span>Decorrido: {formatDuracao(job.elapsed_sec)}</span>
              )}
              {job.eta_sec != null && job.eta_sec > 0 && (
                <span>Restante ~{formatDuracao(job.eta_sec)}</span>
              )}
              {job.status === "pendente" && job.posicao_fila != null && job.posicao_fila > 0 && (
                <span>Posição na fila: {job.posicao_fila}</span>
              )}
            </div>
            <p>A grade atualiza sozinha quando o vídeo ficar pronto.</p>
          </>
        )}
        {job.stale && (
          <>
            <p className="text-destructive">
              Algo deu errado — sem avanço há mais de 10 minutos.
            </p>
            {onRetry && (
              <Button size="sm" variant="outline" disabled={retrying} onClick={() => onRetry(job.id)}>
                {retrying ? "Recriando…" : "Tentar de novo"}
              </Button>
            )}
          </>
        )}
        {failed && job.erro_mensagem && (
          <p className="text-destructive whitespace-pre-wrap">{job.erro_mensagem}</p>
        )}
      </CardContent>
    </Card>
  );
}
