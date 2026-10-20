import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type VehicleMotionJobSnapshot = {
  id: string;
  status: string;
  titulo: string | null;
  erro_mensagem: string | null;
};

const STATUS_LABEL: Record<string, { label: string; variant?: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Na fila", variant: "secondary" },
  processando: { label: "Renderizando", variant: "default" },
  concluido: { label: "Pronto", variant: "default" },
  falha: { label: "Erro", variant: "destructive" },
  falha_definitiva: { label: "Erro", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

export function VehicleVideoJobProgressCard(props: {
  job: VehicleMotionJobSnapshot | null;
}) {
  const { job } = props;
  if (!job) return null;

  const active = job.status === "pendente" || job.status === "processando";
  const failed = job.status === "falha" || job.status === "falha_definitiva";
  if (!active && !failed) return null;

  const meta = STATUS_LABEL[job.status] ?? { label: job.status, variant: "secondary" as const };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          🎬 Vídeo em produção — leva ~3 a 5 min
          {active && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </CardTitle>
        {job.titulo && (
          <p className="text-sm text-muted-foreground truncate">{job.titulo}</p>
        )}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {active && (
          <p>A grade atualiza sozinha quando o vídeo ficar pronto. Pode continuar usando a tela.</p>
        )}
        {failed && job.erro_mensagem && (
          <p className="text-destructive whitespace-pre-wrap">{job.erro_mensagem}</p>
        )}
      </CardContent>
    </Card>
  );
}
