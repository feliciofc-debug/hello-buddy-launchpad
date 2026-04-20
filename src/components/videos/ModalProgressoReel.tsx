import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Film } from 'lucide-react';
import type { ProgressoReel } from '@/hooks/useGerarReel';

interface Props {
  progresso: ProgressoReel;
  aberto: boolean;
  onFechar: () => void;
}

export const ModalProgressoReel = ({ progresso, aberto, onFechar }: Props) => {
  const navigate = useNavigate();
  const etapaFinal = progresso.etapa === 'pronto' || progresso.etapa === 'erro';
  const isErro = progresso.etapa === 'erro';
  const isPronto = progresso.etapa === 'pronto';

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open && etapaFinal) onFechar();
      }}
    >
      <DialogContent
        className="bg-background sm:max-w-md"
        onInteractOutside={(e) => {
          if (!etapaFinal) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!etapaFinal) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPronto ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : isErro ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Film className="h-5 w-5 text-purple-500" />
            )}
            {isPronto ? 'Reel pronto!' : isErro ? 'Erro ao gerar' : 'Gerando seu Reel'}
          </DialogTitle>
          <DialogDescription>
            {isPronto
              ? 'Seu vídeo foi salvo. Confira na aba Vídeos.'
              : isErro
              ? 'Algo deu errado durante a geração.'
              : 'Aguarde enquanto preparamos seu vídeo. Não feche esta janela.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!etapaFinal && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{progresso.mensagem}</span>
            </div>
          )}

          {isErro && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {progresso.mensagem}
            </div>
          )}

          {isPronto && (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              {progresso.mensagem}
            </div>
          )}

          <div className="space-y-1">
            <Progress value={progresso.porcentagem} className="h-2" />
            <p className="text-right text-xs text-muted-foreground">
              {Math.round(progresso.porcentagem)}%
            </p>
          </div>
        </div>

        {isPronto && (
          <Button
            className="w-full"
            onClick={() => {
              onFechar();
              navigate('/meus-produtos?tab=videos');
            }}
          >
            Ver na aba Vídeos
          </Button>
        )}

        {isErro && (
          <Button variant="outline" className="w-full" onClick={onFechar}>
            Fechar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
