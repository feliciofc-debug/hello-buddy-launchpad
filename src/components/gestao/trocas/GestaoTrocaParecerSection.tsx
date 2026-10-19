import type { GestaoTrocaParecerPreviewView } from "@/lib/gestao-troca-parecer-display.ts";

type Props = {
  parecer: GestaoTrocaParecerPreviewView | null;
};

export function GestaoTrocaParecerSection({ parecer }: Props) {
  if (!parecer) return null;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="font-semibold">Parecer da avaliação</p>
      <p className="text-base font-semibold">{parecer.recomendacao.rotulo}</p>
      <div>
        <p className="font-medium">Motivos</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {parecer.recomendacao.motivos.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
      {parecer.recomendacao.pendencias.length > 0 && (
        <div>
          <p className="font-medium">Pendências antes de aprovar</p>
          <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">
            {parecer.recomendacao.pendencias.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {parecer.paragrafo_ia && (
        <p className="rounded-md border bg-muted/30 p-3 leading-relaxed">{parecer.paragrafo_ia}</p>
      )}
    </div>
  );
}
