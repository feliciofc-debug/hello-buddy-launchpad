import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GestaoTrocaLaudoDescricaoSection } from "@/components/gestao/trocas/GestaoTrocaLaudoDescricaoSection.tsx";
import { GestaoTrocaProcedenciaResumo } from "@/components/gestao/trocas/GestaoTrocaProcedenciaResumo.tsx";
import type { GestaoTrocaProcedenciaLaudo } from "@/lib/gestao-troca-procedencia-display.ts";
import type { GestaoTrocaIaQualidadeFoto } from "@/lib/gestao-troca-ia-types.ts";
import type { GestaoTrocaParecerPreviewView } from "@/lib/gestao-troca-parecer-display.ts";

export type GestaoTrocaParecerPreview = GestaoTrocaParecerPreviewView;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  preview: GestaoTrocaParecerPreview | null;
  procedencia: GestaoTrocaProcedenciaLaudo | null;
  qualidade: GestaoTrocaIaQualidadeFoto[];
  thumbUrls: Record<string, string>;
  onAprovar: () => void;
  busy: boolean;
};

export function GestaoTrocaParecerDialog({
  open,
  onOpenChange,
  loading,
  preview,
  procedencia,
  qualidade,
  thumbUrls,
  onAprovar,
  busy,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parecer da avaliação</DialogTitle>
          <DialogDescription>Recomendação por regra + texto opcional da IA (somente fatos).</DialogDescription>
        </DialogHeader>
        {loading || !preview ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Gerando parecer…
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-lg font-semibold">{preview.recomendacao.rotulo}</p>
            <div>
              <p className="font-medium">Motivos</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.recomendacao.motivos.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
            {preview.recomendacao.pendencias.length > 0 && (
              <div>
                <p className="font-medium">Pendências antes de aprovar</p>
                <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">
                  {preview.recomendacao.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {preview.paragrafo_ia && (
              <p className="rounded-md border bg-muted/30 p-3 leading-relaxed">{preview.paragrafo_ia}</p>
            )}
            <div>
              <p className="font-medium">Procedência</p>
              <GestaoTrocaProcedenciaResumo procedencia={procedencia} laudoMode />
            </div>
            <GestaoTrocaLaudoDescricaoSection
              externo={preview.descricao?.externo ?? []}
              interno={preview.descricao?.interno ?? []}
              conclusao_visual={preview.descricao?.conclusao_visual ?? null}
              qualidade={qualidade}
              thumbUrls={thumbUrls}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fechar</Button>
          <Button onClick={onAprovar} disabled={busy || loading || !preview}>
            Aprovar com este parecer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
